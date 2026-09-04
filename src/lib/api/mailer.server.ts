// SMTP email sending. Server-only (.server.ts keeps it out of the client
// bundle) — SMTP credentials must never reach the browser.
//
// Configure via .env:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=<16-char Gmail App Password, NOT your account password>
//   SMTP_FROM="MET Store <you@gmail.com>"     (optional, defaults to SMTP_USER)
//   NOTIFY_EMAIL_TO=you@gmail.com             (where alerts are sent)
//
// If SMTP is not configured, every send becomes a no-op that logs and returns
// { sent: false } — the app keeps working, it just doesn't email.
import nodemailer, { type Transporter } from "nodemailer";

type MailResult = { sent: boolean; reason?: string };

function readConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const defaultTo = process.env.NOTIFY_EMAIL_TO || user;
  return { host, port, user, pass, from, defaultTo };
}

export function isMailConfigured(): boolean {
  const { host, user, pass } = readConfig();
  return !!(host && user && pass);
}

let cachedTransporter: Transporter | undefined;

function getTransporter(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  const { host, port, user, pass } = readConfig();
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export async function sendMail(opts: {
  subject: string;
  text: string;
  html?: string;
  to?: string;
}): Promise<MailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[mailer] SMTP not configured — skipping email:", opts.subject);
    return { sent: false, reason: "SMTP not configured" };
  }

  const { from, defaultTo } = readConfig();
  const to = opts.to || defaultTo;
  if (!to) {
    return { sent: false, reason: "No recipient configured (set NOTIFY_EMAIL_TO)" };
  }

  try {
    await transporter.sendMail({
      from,
      to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? wrapHtml(opts.subject, opts.text),
    });
    return { sent: true };
  } catch (error) {
    // Never let a mail failure break the action that triggered it.
    const reason = error instanceof Error ? error.message : "Unknown SMTP error";
    console.error("[mailer] Failed to send email:", reason);
    return { sent: false, reason };
  }
}

// Minimal branded wrapper so plain-text alerts still look presentable.
function wrapHtml(title: string, body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e5eb">
    <div style="background:#7C3AED;padding:20px 24px">
      <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.02em">MET Store</span>
    </div>
    <div style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:17px;color:#18181b">${title}</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46">${escaped}</p>
    </div>
    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #e5e5eb">
      <span style="font-size:11px;color:#71717a">Automated message from your MET Store inventory system.</span>
    </div>
  </div>
</body></html>`;
}
