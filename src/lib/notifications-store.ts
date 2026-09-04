import { useEffect, useState } from "react";

// ─── types ────────────────────────────────────────────────────────────────────

export type NotificationType = "product" | "category" | "store" | "low-stock";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
};

export type NotificationSettings = {
  email: boolean;
  push: boolean;
  sms: boolean;
};

const KEY = "met_notifications";
const SEEN_KEY = "met_low_stock_seen";
const SETTINGS_KEY = "met_notification_settings";
const MAX_NOTIFICATIONS = 100;

export const LOW_STOCK_THRESHOLD = 5;

// ─── state ────────────────────────────────────────────────────────────────────

let notifications: AppNotification[] = load();
const listeners = new Set<() => void>();

function load(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // storage full or unavailable — in-memory list still works
  }
}

function notify() {
  listeners.forEach((l) => l());
}

// ─── actions ──────────────────────────────────────────────────────────────────

export function addNotification(type: NotificationType, title: string, message: string) {
  if (typeof window === "undefined") return;
  const item: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
    createdAt: Date.now(),
    read: false,
  };
  notifications = [item, ...notifications].slice(0, MAX_NOTIFICATIONS);
  persist();
  notify();

  const settings = getNotificationSettings();

  // Browser push notification when the user enabled it in Settings
  if (settings.push && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body: message });
    } catch {
      // Some browsers (mobile) disallow constructor — ignore
    }
  }

  // Email via the server's SMTP route. Fire-and-forget: a mail failure must
  // never break the action (adding a product, etc.) that triggered it.
  if (settings.email) {
    void sendEmailNotification(title, message);
  }
}

async function sendEmailNotification(subject: string, message: string) {
  try {
    const token = getStoredAccessToken();
    if (!token) return; // demo/offline session — nothing to authenticate with

    await fetch("/api/notify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject, message }),
    });
  } catch {
    // Offline or server unreachable — the in-app notification still stands.
  }
}

// Reads the Supabase access token straight from localStorage rather than
// calling supabase.auth.getSession(), which would pull the auth client (and
// its lock) into this module for what is a fire-and-forget side effect.
function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "");
      if (parsed?.access_token) return parsed.access_token as string;
    } catch {
      // malformed entry — keep looking
    }
  }
  return null;
}

export function markAllRead() {
  notifications = notifications.map((n) => (n.read ? n : { ...n, read: true }));
  persist();
  notify();
}

export function clearNotifications() {
  notifications = [];
  persist();
  notify();
}

export function getUnreadCount() {
  return notifications.filter((n) => !n.read).length;
}

// ─── low stock detection ──────────────────────────────────────────────────────

// Called every time products are (re)loaded from the database. Notifies once
// per product while it stays below the threshold; resets when restocked.
export function checkLowStock(products: { id: string; name: string; stock: number }[]) {
  if (typeof window === "undefined") return;
  let seen: Record<string, boolean> = {};
  try {
    seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
  } catch {
    seen = {};
  }

  let changed = false;
  for (const p of products) {
    if (p.stock < LOW_STOCK_THRESHOLD) {
      if (!seen[p.id]) {
        seen[p.id] = true;
        changed = true;
        addNotification(
          "low-stock",
          "Low stock alert",
          `"${p.name}" is running low — only ${p.stock} left in stock.`
        );
      }
    } else if (seen[p.id]) {
      delete seen[p.id];
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      // ignore
    }
  }
}

// ─── settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: NotificationSettings = { email: true, push: false, sms: false };

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setNotificationSetting(key: keyof NotificationSettings, value: boolean) {
  if (typeof window === "undefined") return;
  const next = { ...getNotificationSettings(), [key]: value };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  if (key === "push" && value && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  notify();
}

// ─── hooks ────────────────────────────────────────────────────────────────────

export function useNotifications(): AppNotification[] {
  const [list, setList] = useState<AppNotification[]>(notifications);
  useEffect(() => {
    const onChange = () => setList([...notifications]);
    listeners.add(onChange);
    onChange();
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return list;
}

export function useUnreadCount(): number {
  const list = useNotifications();
  return list.filter((n) => !n.read).length;
}

export function useNotificationSettings(): NotificationSettings {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  useEffect(() => {
    const onChange = () => setSettings(getNotificationSettings());
    listeners.add(onChange);
    onChange();
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return settings;
}
