import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { registerQueryCache } from "./lib/auth-store";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Every inventory query needs the *browser's* Supabase session — the
        // server has none, so running them during SSR returns nothing and that
        // empty result was being handed to the client as already-settled data.
        // That's why a hard refresh showed "No products found" while in-app
        // navigation worked. Disabling on the server means the client always
        // fetches for real once it has the session.
        enabled: typeof window !== "undefined",
        // staleTime 0 + refetchOnMount: a query that resolved empty (e.g. it
        // ran before the session was restored) must never stay "fresh" and
        // silently skip a retry. Inventory screens are small; correctness
        // matters more than saving a request.
        staleTime: 0,
        refetchOnMount: "always",
        // Coming back to the tab should show current data.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });

  // Lets auth-store drop cached per-user data when the signed-in user changes,
  // so a new login never shows the previous account's cached results.
  // resetQueries (not clear) — it discards the data AND refetches anything
  // currently mounted, so on-screen queries recover instead of hanging.
  //
  // Browser only: getRouter() also runs per-request during SSR, and
  // registerQueryCache writes to a module-level slot that is shared across
  // requests on the server. Registering there would let one request's query
  // client be reset by another's auth events.
  if (typeof window !== "undefined") {
    registerQueryCache({ reset: () => void queryClient.resetQueries() });
  }

  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
