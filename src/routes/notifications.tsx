import { createFileRoute } from "@tanstack/react-router";
import { Package, LayoutGrid, Store as StoreIcon, AlertTriangle, Bell, CheckCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/met/AppShell";
import {
  useNotifications,
  markAllRead,
  clearNotifications,
  type NotificationType,
} from "@/lib/notifications-store";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MET" }] }),
  component: NotificationsPage,
});

const typeIcon: Record<NotificationType, { icon: typeof Package; bg: string; fg: string }> = {
  product: { icon: Package, bg: "bg-blue-100", fg: "text-blue-600" },
  category: { icon: LayoutGrid, bg: "bg-purple-100", fg: "text-purple-600" },
  store: { icon: StoreIcon, bg: "bg-emerald-100", fg: "text-emerald-600" },
  "low-stock": { icon: AlertTriangle, bg: "bg-amber-100", fg: "text-amber-600" },
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function NotificationsPage() {
  const notifications = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <AppShell title="Notifications">
      <div className="px-5 pt-4 pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">
            Notifications
            {unread > 0 && (
              <span className="ml-2 align-middle px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {unread} new
              </span>
            )}
          </h2>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="h-9 px-3 rounded-full bg-card border border-border text-xs font-semibold inline-flex items-center gap-1.5 text-primary"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark read
                </button>
              )}
              <button
                onClick={clearNotifications}
                className="h-9 px-3 rounded-full bg-card border border-border text-xs font-semibold inline-flex items-center gap-1.5 text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-14">
            <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center">
              <Bell className="h-8 w-8 text-primary-deep" />
            </div>
            <p className="font-bold">No notifications yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              You'll see alerts here when products, categories or stores are added — and when stock
              runs low.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n) => {
              const t = typeIcon[n.type] ?? typeIcon.product;
              const Icon = t.icon;
              return (
                <div
                  key={n.id}
                  className={`rounded-2xl p-3.5 border flex gap-3 ${
                    n.read ? "bg-card border-border/50" : "bg-accent/40 border-accent"
                  }`}
                >
                  <div className={`h-10 w-10 rounded-xl ${t.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${t.fg}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
