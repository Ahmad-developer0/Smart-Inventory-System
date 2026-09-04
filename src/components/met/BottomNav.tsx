import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Store, Package, LayoutGrid } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/stores", label: "Stores", icon: Store },
  { to: "/products", label: "Product", icon: Package },
  { to: "/categories", label: "Categories", icon: LayoutGrid },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-card border-t border-border/60 z-20">
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active =
            t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
