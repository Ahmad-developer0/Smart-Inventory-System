// Plain HTTP handler (not a TanStack `createServerFn`) for admin-only user
// management. `createServerFn`'s client-RPC stub generation is currently
// broken in this project — the installed @tanstack/start-* package versions
// (see `npm ls @tanstack/start-client-core @tanstack/start-plugin-core`) leave
// `process.env.TSS_SERVER_FN_BASE` undefined in the browser bundle, and
// forcing it into Vite's dependency pre-bundle to fix that pulls in
// `@tanstack/react-start-rsc`'s server-only AsyncLocalStorage usage instead.
// This route sidesteps that subsystem entirely: the client calls it with a
// plain `fetch()` (see admin-users.tsx), carrying the Supabase access token
// as a Bearer header, verified below exactly like auth-middleware.ts does.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { Role } from "@/lib/auth-store";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function authenticateCaller(request: Request): Promise<{ supabase: SupabaseClient<Database>; userId: string }> {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: missing bearer token.");
  }
  const token = authHeader.slice("Bearer ".length);

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    // Node < 22 has no global WebSocket; see client.server.ts for why this is here.
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("Unauthorized: invalid token.");
  }
  return { supabase, userId: data.claims.sub };
}

async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (error || data?.role !== "admin") {
    throw new Error("Forbidden: admin role required.");
  }
}

async function listUsers() {
  const [{ data: profiles, error: profilesError }, { data: authList, error: authError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name, role, created_at"),
    supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
  ]);
  if (profilesError) throw profilesError;
  if (authError) throw authError;

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return authList.users
    .map((u) => {
      const profile = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        displayName: profile?.display_name || u.email?.split("@")[0] || "—",
        role: (profile?.role ?? "viewer") as Role,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

async function createUserAccount(input: {
  email: string;
  password: string;
  displayName?: string;
  role: Role;
}) {
  if (!input.email || !input.password || input.password.length < 6) {
    throw new Error("Email and a password of at least 6 characters are required.");
  }
  if (input.role !== "admin" && input.role !== "viewer") {
    throw new Error("Role must be admin or viewer.");
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(createError?.message || "Failed to create user.");
  }

  const displayName = input.displayName?.trim() || input.email.split("@")[0];
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: created.user.id,
    display_name: displayName,
    role: input.role,
  });
  if (profileError) throw profileError;

  return { id: created.user.id, email: input.email, displayName, role: input.role };
}

async function updateUserRole(callerId: string, input: { userId: string; role: Role }) {
  if (input.role !== "admin" && input.role !== "viewer") {
    throw new Error("Role must be admin or viewer.");
  }
  if (input.userId === callerId && input.role !== "admin") {
    throw new Error("You can't remove your own admin access.");
  }

  const { data: updated, error } = await supabaseAdmin
    .from("profiles")
    .update({ role: input.role })
    .eq("id", input.userId)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

export async function handleAdminUsersRequest(request: Request): Promise<Response> {
  try {
    const { supabase, userId } = await authenticateCaller(request);
    await requireAdmin(supabase, userId);

    if (request.method === "GET") {
      return jsonResponse(await listUsers());
    }

    if (request.method === "POST") {
      const body = (await request.json()) as { action: "create" | "updateRole"; [key: string]: unknown };
      if (body.action === "create") {
        return jsonResponse(
          await createUserAccount(body as unknown as Parameters<typeof createUserAccount>[0])
        );
      }
      if (body.action === "updateRole") {
        return jsonResponse(
          await updateUserRole(userId, body as unknown as Parameters<typeof updateUserRole>[1])
        );
      }
      return jsonResponse({ error: "Unknown action." }, 400);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status = message.startsWith("Unauthorized") ? 401 : message.startsWith("Forbidden") ? 403 : 400;
    return jsonResponse({ error: message }, status);
  }
}
