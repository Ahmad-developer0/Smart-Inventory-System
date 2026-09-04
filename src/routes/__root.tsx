import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { useRole } from "@/lib/auth-store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "MET — Inventory Management" },
      { name: "description", content: "Mobile-first inventory management for multi-store retail." },
      { name: "author", content: "MET" },
      { property: "og:title", content: "MET — Inventory Management" },
      { property: "og:description", content: "Mobile-first inventory management for multi-store retail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// The splash is injected via dangerouslySetInnerHTML rather than as regular
// JSX, and hidden with a CSS class rather than by removing the node.
//
// Why: React must not have this element in its virtual tree. An earlier
// version rendered it as JSX and then called .remove() on the real DOM node —
// deleting a node React owns breaks hydration/reconciliation, which froze the
// whole page (splash stuck up, queries never running). Injected HTML is
// outside React's tree, so toggling a class on it is safe.
const SPLASH_HTML = `
<div id="met-splash" class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary transition-opacity duration-200">
  <div class="relative flex items-center justify-center">
    <span class="absolute text-[70px] font-extrabold text-white opacity-[0.06] tracking-tight whitespace-nowrap select-none">MET Store</span>
    <h1 class="relative text-3xl font-bold tracking-tight text-white select-none">MET Store</h1>
  </div>
  <div class="mt-8 flex gap-2" role="status" aria-label="Loading">
    <span class="h-2.5 w-2.5 rounded-full bg-white/80 animate-bounce [animation-delay:-0.3s]"></span>
    <span class="h-2.5 w-2.5 rounded-full bg-white/80 animate-bounce [animation-delay:-0.15s]"></span>
    <span class="h-2.5 w-2.5 rounded-full bg-white/80 animate-bounce"></span>
  </div>
</div>`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style
          dangerouslySetInnerHTML={{
            __html: `#met-splash.met-splash-hidden{opacity:0;pointer-events:none;visibility:hidden}`,
          }}
        />
      </head>
      <body>
        <div dangerouslySetInnerHTML={{ __html: SPLASH_HTML }} suppressHydrationWarning />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const role = useRole();
  const navigate = useNavigate();
  const routerStatus = useRouterState({ select: (s) => s.status });

  useEffect(() => {
    if (!role && location.pathname !== "/login") {
      navigate({ to: "/login", replace: true });
    } else if (role && location.pathname === "/login") {
      navigate({ to: "/", replace: true });
    }
  }, [role, location.pathname, navigate]);

  useEffect(() => {
    // Hide (never remove) the splash once the router has finished resolving
    // the target route. The node lives outside React's tree, so toggling a
    // class is safe — removing it would tear DOM out from under React.
    // The rAF lets the real route paint first, avoiding a blank flash.
    if (routerStatus !== "idle") return;
    const raf = requestAnimationFrame(() => {
      document.getElementById("met-splash")?.classList.add("met-splash-hidden");
    });
    return () => cancelAnimationFrame(raf);
  }, [routerStatus, location.pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
