import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Zap, LogOut, Bell, ChevronRight, Users } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import { Switch } from "@/components/ui/switch";
import { clearRole, useRole } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import {
  useNotificationSettings,
  setNotificationSetting,
  useUnreadCount,
} from "@/lib/notifications-store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MET" }] }),
  component: SettingsPage,
});

function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      // On a fresh page load the Supabase client restores its session from
      // storage asynchronously, so the first getSession() right after mount
      // can legitimately return null even though a valid session exists.
      // Retry briefly before concluding there is no session — otherwise the
      // page settles into a signed-out-looking state and never recovers.
      let user = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data } = await withTimeout(supabase.auth.getSession(), 8_000);
        user = data.session?.user ?? null;
        if (user) break;
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!user) return null;

      const { data: profile } = await withTimeout(
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        8_000
      );
      return {
        username: profile?.display_name || user.email?.split("@")[0] || "",
        email: user.email ?? "",
      };
    },
    retry: 1,
    staleTime: 60_000,
  });
}

function SettingsPage() {
  const navigate = useNavigate();
  const role = useRole();
  const isAdmin = role === "admin";
  const { data: profile, isLoading: profileLoading } = useProfile();
  const settings = useNotificationSettings();
  const unread = useUnreadCount();

  // NEVER fall back to `role` for the username: "viewer"/"admin" are role
  // names, and rendering one as a username makes the page look like it
  // switched to a different account (this is exactly what happened on reload,
  // while the real profile query was still settling). Only ever show the real
  // display name; otherwise show the loading skeleton or an explicit label.
  const isDemoSession = !profileLoading && profile === null;
  const username = profile?.username || (isDemoSession ? "Demo session" : "");
  const initial = (profile?.username || "U").charAt(0).toUpperCase();

  return (
    <AppShell title="Settings">
      <div className="px-4 pt-4 pb-6 space-y-4">
        <h2 className="text-xl font-extrabold">Settings</h2>

        {/* Account card */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <h3 className="font-bold text-base mb-4">Account</h3>
          <div className="flex items-center gap-4">
            {profileLoading ? (
              <div className="h-16 w-16 rounded-2xl bg-muted animate-pulse shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-2xl font-extrabold shrink-0">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              {profileLoading ? (
                <div className="h-5 w-28 rounded bg-muted animate-pulse" />
              ) : (
                <p className="font-extrabold text-lg truncate">{username}</p>
              )}
              <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                {isAdmin ? "Admin" : "Viewer"}
              </span>
            </div>
          </div>

          <hr className="border-border/60 my-4" />

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-semibold">
                {profileLoading ? <span className="inline-block h-4 w-16 rounded bg-muted animate-pulse" /> : username}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-semibold">{isAdmin ? "Admin" : "Viewer"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Access Level</dt>
              <dd className="font-semibold">{isAdmin ? "Full Access" : "Read Only"}</dd>
            </div>
            {profileLoading ? (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd><span className="inline-block h-4 w-32 rounded bg-muted animate-pulse" /></dd>
              </div>
            ) : profile?.email ? (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-semibold truncate max-w-[200px]">{profile.email}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {/* Admin-only: user & role management */}
        {isAdmin && (
          <Link
            to="/admin-users"
            className="flex items-center justify-between rounded-2xl bg-card px-5 py-4 shadow-sm border border-border/50"
          >
            <span className="inline-flex items-center gap-2 font-bold text-sm">
              <Users className="h-4 w-4 text-primary" />
              Manage users &amp; roles
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}

        {/* Notifications card */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <h3 className="font-bold text-base">Notifications</h3>
          <p className="text-sm text-muted-foreground mt-0.5 mb-4">
            Manage how you receive notifications
          </p>

          <div className="divide-y divide-border/60">
            <ToggleRow
              title="Email Notifications"
              subtitle="Receive updates via email"
              checked={settings.email}
              onChange={(v) => setNotificationSetting("email", v)}
            />
            <ToggleRow
              title="Push Notifications"
              subtitle="Browser push notifications"
              checked={settings.push}
              onChange={(v) => setNotificationSetting("push", v)}
            />
            <ToggleRow
              title="SMS Notifications"
              subtitle="Text message alerts"
              checked={settings.sms}
              onChange={(v) => setNotificationSetting("sms", v)}
            />
          </div>

          <Link
            to="/notifications"
            className="mt-3 flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              View notifications
              {unread > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center">
                  {unread}
                </span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            clearRole();
            navigate({ to: "/login" });
          }}
          className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </AppShell>
  );
}

function ToggleRow({
  title,
  subtitle,
  checked,
  onChange,
}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
