import { useEffect, useState } from "react";
import { withTimeout } from "./with-timeout";

export type Role = "admin" | "viewer";
const KEY = "met_role";
const ROLE_FETCH_TIMEOUT_MS = 10_000;

let globalRole: Role | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

// Cached query data (profile, products, …) belongs to whoever was signed in
// when it was fetched. When the user changes, that cache is stale for the new
// user — without resetting it, signing in as someone else keeps showing the
// previous account until a manual page refresh. The query client registers
// itself here so this module can reset it on any identity change.
//
// NOTE: this must reset (clear + refetch active queries), never `clear()`.
// `clear()` wipes the cache out from under already-mounted queries, leaving
// their observers orphaned — the Dashboard then spins forever because those
// queries never run again.
type CacheResetter = { reset: () => void };
let queryCache: CacheResetter | null = null;
let lastUserId: string | null = null;
let seenFirstAuthEvent = false;

export function registerQueryCache(cache: CacheResetter) {
  queryCache = cache;
}

// Initialize from localStorage synchronously (safe for SSR too)
if (typeof window !== "undefined") {
  const cached = localStorage.getItem(KEY);
  if (cached === "admin" || cached === "viewer") {
    globalRole = cached;
  }

  // Subscribe to Supabase auth state changes lazily to avoid crashing if env
  // vars are not set. `requestId` guards against out-of-order responses: if a
  // slow request from an earlier event resolves after a newer one already
  // started, its (possibly stale) result is discarded instead of silently
  // overwriting the current, correct role — this is what caused role to
  // flip-flop after several quick reloads/re-logins.
  let requestId = 0;
  try {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.onAuthStateChange(async (_event, session) => {
        // Identity changed (a *different* user signed in, or signed out): drop
        // cached query data so nothing from the previous account lingers.
        //
        // `seenFirstAuthEvent` matters: on every page load Supabase replays the
        // restored session (SIGNED_IN / INITIAL_SESSION). Without this guard,
        // lastUserId is still null on that first event, it looks like an
        // identity change, and resetQueries() cancels the queries the page just
        // started — leaving the UI stuck on "not found"/empty. The first event
        // only establishes who we are; it is never a switch.
        const currentUserId = session?.user?.id ?? null;
        if (!seenFirstAuthEvent) {
          seenFirstAuthEvent = true;
          lastUserId = currentUserId;
        } else if (currentUserId !== lastUserId) {
          lastUserId = currentUserId;
          queryCache?.reset();
        }

        if (session?.user) {
          const thisRequestId = ++requestId;
          try {
            const { data, error } = await withTimeout(
              supabase.from("profiles").select("role").eq("id", session.user.id).single(),
              ROLE_FETCH_TIMEOUT_MS
            );
            if (thisRequestId !== requestId) return; // superseded by a newer event

            if (!error && data && (data.role === "admin" || data.role === "viewer")) {
              globalRole = data.role;
              localStorage.setItem(KEY, data.role);
              notify();
            }
            // On error/timeout: leave globalRole untouched rather than
            // guessing — it already holds whatever login.tsx or the last
            // successful sync set, which is the best information available.
          } catch {
            // Timed out or threw — same as above, leave globalRole as-is.
          }
        } else if (_event === "SIGNED_OUT") {
          globalRole = null;
          localStorage.removeItem(KEY);
          notify();
        }
      });
    }).catch(() => {
      // Supabase not configured — local-only auth continues to work
      console.warn("[Auth] Supabase not configured, using local auth only.");
    });
  } catch {
    // Ignore
  }
}

export function setRole(role: Role) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, role);
    globalRole = role;
    // Covers the offline/demo login path, which sets a role without any
    // Supabase auth event firing — the listener above would never see it.
    queryCache?.reset();
    notify();
  }
}

export function getRole(): Role | null {
  return globalRole;
}

export function clearRole() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    globalRole = null;
    lastUserId = null;
    // An explicit logout ends the current identity, so the next auth event
    // genuinely starts a new one rather than replaying a restored session.
    seenFirstAuthEvent = true;
    queryCache?.reset();
    notify();
    // Sign out of Supabase in the background (non-blocking)
    import("@/integrations/supabase/client")
      .then(({ supabase }) => supabase.auth.signOut())
      .catch(() => {});
  }
}

export function useRole(): Role | null {
  const [role, setR] = useState<Role | null>(globalRole);
  useEffect(() => {
    const onChange = () => setR(globalRole);
    listeners.add(onChange);
    // Re-read in case it changed between render and effect
    setR(globalRole);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return role;
}

// Demo credentials for v1
export const CREDENTIALS: Record<string, { password: string; role: Role }> = {
  admin: { password: "admin123", role: "admin" },
  viewer: { password: "viewer123", role: "viewer" },
};
