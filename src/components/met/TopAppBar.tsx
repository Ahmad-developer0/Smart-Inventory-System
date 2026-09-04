import { Menu, User, Bell } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SideDrawer } from "./SideDrawer";
import { useUnreadCount } from "@/lib/notifications-store";

export function TopAppBar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  return (
    <>
      <header className="h-14 px-4 flex items-center justify-between bg-background sticky top-0 z-20 border-b border-border/60">
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 text-foreground"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-primary tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center text-foreground"
          >
            <Bell className="h-4.5 w-4.5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <SideDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
