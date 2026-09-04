import { Link, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { clearRole } from "@/lib/auth-store";

const links = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/stores", label: "Stores" },
  { to: "/finances", label: "Finances" },
  { to: "/notifications", label: "Notifications" },
  { to: "/settings", label: "Settings" },
] as const;

export function SideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="w-full max-w-[420px] bg-drawer text-primary-foreground flex flex-col animate-in fade-in slide-in-from-left-4 duration-200">
        <div className="h-14 px-4 flex items-center">
          <button onClick={onClose} aria-label="Close menu" className="p-2 -ml-2">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="text-center pt-2 pb-10">
          <h2 className="text-2xl font-extrabold tracking-tight">MET &nbsp; Store</h2>
        </div>
        <nav className="flex-1 flex flex-col items-center gap-6 mt-8">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={onClose}
              className="text-2xl font-bold text-primary-foreground hover:opacity-80"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => {
            clearRole();
            onClose();
            navigate({ to: "/login" });
          }}
          className="text-center text-sm font-medium pb-10 pt-6 opacity-90 hover:opacity-100"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
