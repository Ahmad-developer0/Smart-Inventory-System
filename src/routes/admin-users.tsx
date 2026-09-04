import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { useRole } from "@/lib/auth-store";
import type { Role } from "@/lib/auth-store";

export const Route = createFileRoute("/admin-users")({
  head: () => ({ meta: [{ title: "Manage Users — MET" }] }),
  component: AdminUsersPage,
});

const inputCls =
  "w-full h-11 px-4 rounded-xl bg-muted border border-transparent focus:border-primary focus:bg-card outline-none text-sm disabled:opacity-50";

type AdminUser = { id: string; email: string; displayName: string; role: Role };

// Reads the access token directly out of localStorage instead of calling
// supabase.auth.getSession(): that call queues behind supabase-js's internal
// auth lock (shared with the app-wide onAuthStateChange listener and any
// in-flight refresh), and can hang indefinitely if that lock is ever stuck.
// The session is already persisted here (persistSession: true), so a direct
// read is both faster and immune to that lock entirely.
function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.access_token) return parsed.access_token as string;
    } catch {
      // ignore malformed entry, keep looking
    }
  }
  return null;
}

const REQUEST_TIMEOUT_MS = 12_000;

async function adminUsersRequest<T>(init?: RequestInit): Promise<T> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Not signed in.");

  // AbortController so a hung request (dev-server restart, dropped
  // connection) can never leave the UI stuck loading indefinitely.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("/api/admin-users", {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || "Request failed.");
  return body as T;
}

function AdminUsersPage() {
  const role = useRole();

  if (role !== "admin") {
    return (
      <AppShell title="Manage users">
        <div className="p-6 text-center text-muted-foreground">
          Only admins can manage user roles.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Manage users">
      <div className="px-5 pt-4 pb-6 space-y-5">
        <AddUserCard />
        <UserList />
      </div>
    </AppShell>
  );
}

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => await adminUsersRequest<AdminUser[]>({ method: "GET" }),
    retry: 0,
    staleTime: 10_000,
  });
}

function AddUserCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async (input: { email: string; password: string; displayName: string; role: "admin" | "viewer" }) =>
      await adminUsersRequest<{ email: string }>({
        method: "POST",
        body: JSON.stringify({ action: "create", ...input }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`Account created for ${data.email}.`);
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create user."),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const displayName = String(form.get("displayName") || "").trim();
    const role = String(form.get("role") || "viewer") as "admin" | "viewer";

    if (!email || !password) {
      toast.error("Email and password are required.");
      return;
    }
    mutation.mutate({ email, password, displayName, role });
  }

  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between font-bold text-base"
      >
        <span className="inline-flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" /> Add user
        </span>
        <span className="text-xs text-muted-foreground font-medium">{open ? "Close" : "New"}</span>
      </button>

      {open && (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input name="email" type="email" placeholder="Email" required disabled={mutation.isPending} className={inputCls} />
          <input
            name="password"
            type="password"
            placeholder="Temporary password"
            required
            minLength={6}
            disabled={mutation.isPending}
            className={inputCls}
          />
          <input
            name="displayName"
            type="text"
            placeholder="Display name (optional)"
            disabled={mutation.isPending}
            className={inputCls}
          />
          <select name="role" disabled={mutation.isPending} defaultValue="viewer" className={inputCls}>
            <option value="viewer">Viewer — read only</option>
            <option value="admin">Admin — full access</option>
          </select>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>
      )}
    </div>
  );
}

function UserList() {
  const { data: users, isLoading, error } = useUsers();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 text-primary">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center py-6 text-sm text-destructive">
        {(error as Error).message || "Failed to load users."}
      </p>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border/50 divide-y divide-border/60">
      {users && users.length > 0 ? (
        users.map((u) => <UserRow key={u.id} user={u} />)
      ) : (
        <p className="text-center py-6 text-sm text-muted-foreground">No users yet.</p>
      )}
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (role: "admin" | "viewer") =>
      await adminUsersRequest({
        method: "POST",
        body: JSON.stringify({ action: "updateRole", userId: user.id, role }),
      }),
    onSuccess: (_data, role) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`${user.email} is now ${role}.`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update role."),
  });

  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{user.displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      <select
        value={user.role}
        disabled={mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.value as "admin" | "viewer")}
        className="h-9 px-3 rounded-full bg-muted border border-transparent focus:border-primary outline-none text-xs font-semibold disabled:opacity-50 shrink-0 inline-flex items-center gap-1"
      >
        <option value="viewer">Viewer</option>
        <option value="admin">Admin</option>
      </select>
    </div>
  );
}
