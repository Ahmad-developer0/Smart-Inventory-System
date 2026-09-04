import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CREDENTIALS, setRole } from "@/lib/auth-store";
import { MobileFrame } from "@/components/met/MobileFrame";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";

const AUTH_TIMEOUT_MS = 12_000;

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — MET" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);

    const userKey = username.trim().toLowerCase();
    const entry = CREDENTIALS[userKey];
    const isDemoUser = !!entry && entry.password === password;
    let email = username.trim();
    if (!email.includes("@")) {
      email = `${userKey}@met.com`;
    }

    try {
      // Every Supabase call below is wrapped in withTimeout so a hung network
      // request or dev-server restart can never leave this button stuck on
      // "Logging in..." forever — it fails fast into the same catch block
      // below (which already falls back to the local demo session).

      // 1. Try to log in via Supabase Auth
      let { data: signInData, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_TIMEOUT_MS
      );

      // 2. If the demo user doesn't exist yet, register it and sign in again
      if (signInError && isDemoUser) {
        const { data: signUpData, error: signUpError } = await withTimeout(
          supabase.auth.signUp({ email, password }),
          AUTH_TIMEOUT_MS
        );

        if (!signUpError && signUpData?.user) {
          if (signUpData.session) {
            signInData = { user: signUpData.user, session: signUpData.session };
            signInError = null;
          } else {
            // Some projects require email confirmation — retry password sign-in once
            const retry = await withTimeout(
              supabase.auth.signInWithPassword({ email, password }),
              AUTH_TIMEOUT_MS
            );
            signInData = retry.data;
            signInError = retry.error;
          }

          // 3. Create/refresh the profile row (best-effort, never blocks login)
          if (signInData?.session) {
            const { error: profileError } = await withTimeout(
              supabase.from("profiles").upsert({
                id: signUpData.user.id,
                display_name: username.trim(),
                role: entry.role,
              }),
              AUTH_TIMEOUT_MS
            );
            if (profileError) {
              console.error("[Auth] Profile creation failed:", profileError);
            }
          }
        }
      }

      // 4. Signed in to Supabase — resolve the role and continue.
      // Always trust the database profile over the hardcoded demo role once a
      // real session exists — otherwise a demo account demoted via the admin
      // panel (Manage users & roles) would silently regain admin on every
      // login, defeating role management entirely.
      if (signInData?.session) {
        const { data: profile } = await withTimeout(
          supabase.from("profiles").select("role").eq("id", signInData.session.user.id).single(),
          AUTH_TIMEOUT_MS
        );
        const resolvedRole = profile?.role === "admin" ? "admin" : profile?.role === "viewer" ? "viewer" : entry?.role;
        if (!resolvedRole) {
          setError("Could not resolve account role.");
          return;
        }
        setRole(resolvedRole);
        navigate({ to: "/" });
        return;
      }

      // 5. Supabase answered and explicitly rejected these credentials — that
      // is a real "wrong username/password", so surface it. Only fall back to
      // the offline demo session when Supabase could not be reached at all,
      // otherwise a wrong password silently signs you in as the demo user and
      // the app then shows that account instead of the one you typed.
      const credentialsRejected =
        signInError?.message?.toLowerCase().includes("invalid login credentials") ?? false;

      if (isDemoUser && !credentialsRejected) {
        console.warn("[Auth] Supabase sign-in unavailable, using local demo session.");
        setRole(entry.role);
        navigate({ to: "/" });
        return;
      }

      setError(
        credentialsRejected
          ? "Incorrect username or password."
          : signInError?.message || "Invalid credentials."
      );
    } catch (err) {
      // Supabase client threw before answering (missing env, network down,
      // timeout) — nothing was rejected, so the offline demo session is the
      // right fallback here.
      if (isDemoUser) {
        setRole(entry.role);
        navigate({ to: "/" });
        return;
      }
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileFrame>
      <div className="flex-1 bg-primary text-primary-foreground relative flex flex-col px-6 py-10 min-h-screen select-none">
        <form onSubmit={onSubmit} className="flex-1 flex flex-col justify-between">
          {/* Header Section at top */}
          <div className="relative pt-6 pb-2 flex flex-col items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
              <span className="text-[90px] font-extrabold text-white opacity-[0.06] tracking-tight whitespace-nowrap">
                MET Store
              </span>
            </div>
            <h1 className="relative text-4xl font-bold tracking-tight text-white select-none">
              MET Store
            </h1>
          </div>

          {/* Form Fields Section in the center */}
          <div className="flex-1 flex flex-col justify-center space-y-6 px-1 my-auto max-w-full">
            <div>
              <label className="block text-white text-sm font-semibold tracking-wide mb-2" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full h-12 rounded-xl px-4 bg-white text-slate-900 font-medium outline-none transition-all focus:ring-2 focus:ring-white/40 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-white text-sm font-semibold tracking-wide mb-2" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full h-12 rounded-xl px-4 bg-white text-slate-900 font-medium outline-none transition-all focus:ring-2 focus:ring-white/40 disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-xs text-center text-red-200 bg-red-950/20 py-2 rounded-lg border border-red-500/20 font-medium">
                {error}
              </p>
            )}
          </div>

          {/* Button at the end */}
          <div className="px-1 mt-auto pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-white text-primary font-bold text-base hover:bg-white/95 active:scale-[0.99] transition-all shadow-md flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </div>
        </form>
      </div>
    </MobileFrame>
  );
}
