// HTTP handler that turns an in-app notification into an email.
//
// Authenticated the same way as admin-users.server.ts (Supabase access token
// as a Bearer header) so this cannot be used as an open relay — only a signed
// in user can trigger a send, and only to the address configured server-side
// in NOTIFY_EMAIL_TO. The client never chooses the recipient.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import type { Database } from "@/integrations/supabase/types";
import { sendMail, isMailConfigured } from "./mailer.server";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function authenticateCaller(request: Request): Promise<{ userId: string; email: string | null }> {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: missing bearer token.");
  }
  const token = authHeader.slice("Bearer ".length);

  const supabase: SupabaseClient<Database> = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    }
  );

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("Unauthorized: invalid token.");
  }
  // The email comes from the verified JWT, not from the request body, so a
  // caller cannot direct mail at an address that isn't their own.
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { userId: data.claims.sub, email };
}

export async function handleNotifyRequest(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") {
      // Lets Settings show whether email can actually be sent.
      return jsonResponse({ configured: isMailConfigured() });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const caller = await authenticateCaller(request);

    const body = (await request.json()) as { subject?: string; message?: string };
    const subject = (body.subject ?? "").trim();
    const message = (body.message ?? "").trim();
    if (!subject || !message) {
      return jsonResponse({ error: "subject and message are required." }, 400);
    }

    // Recipient is always the signed-in user's own verified address (from the
    // JWT), falling back to NOTIFY_EMAIL_TO only if the token carries no email.
    // A `to` field in the request body is deliberately NOT honoured — otherwise
    // any signed-in user could use this endpoint to mail arbitrary addresses.
    const result = await sendMail({
      subject,
      text: message,
      to: caller.email ?? undefined,
    });
    return jsonResponse(result, result.sent ? 200 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return jsonResponse({ error: message }, status);
  }
}
