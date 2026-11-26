import nodemailer from "nodemailer";

let cachedTransport;
let cachedConfigKey;

function getTransport() {
  const host = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const user = String(process.env.NODEMAILER_EMAIL || "").trim();
  const pass = String(process.env.NODEMAILER_APP_PASSWORD || "").replace(/\s/g, "");
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass) return null;
  const configKey = `${host}:${port}:${process.env.SMTP_SECURE === "true"}:${user}:${pass}`;
  if (!cachedTransport || cachedConfigKey !== configKey) {
    cachedTransport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === "true" || port === 465, auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
    cachedConfigKey = configKey;
  }
  return { transport: cachedTransport, from: `ShopAI Concierge <${user}>`, replyTo: user };
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const formatDate = (value) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value || Date.now()));

function ticketEmailHtml({ title, greeting, status, ticket, shopName }) {
  const detailText = escapeHtml(ticket.message || "No additional details were provided.").replace(/\r?\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f3f0;font-family:Arial,Helvetica,sans-serif;color:#292622"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3f0;padding:32px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e9e3dc;border-radius:16px;overflow:hidden"><tr><td style="height:6px;background:#e96822;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:26px 30px 20px;background:#171717;color:#fff"><div style="font-size:11px;font-weight:700;letter-spacing:1.6px;color:#ffb184">SHOPAI CONCIERGE</div><div style="margin-top:10px;font-size:22px;font-weight:700;line-height:1.3">${escapeHtml(title)}</div></td></tr><tr><td style="padding:28px 30px 12px"><p style="margin:0 0 10px;font-size:15px;line-height:1.6">Hello ${escapeHtml(ticket.customer || "there")},</p><p style="margin:0;color:#655d55;font-size:14px;line-height:1.65">${escapeHtml(greeting)}</p></td></tr><tr><td style="padding:18px 30px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eee7df;border-radius:12px;background:#fffaf6"><tr><td style="padding:16px 18px"><div style="font-size:10px;font-weight:700;letter-spacing:1.1px;color:#9c7660">TICKET REFERENCE</div><div style="padding-top:5px;font-size:18px;font-weight:700;color:#a64a1c">${escapeHtml(ticket.reference)}</div><div style="padding-top:13px;font-size:10px;font-weight:700;letter-spacing:1.1px;color:#9c7660">SUBJECT</div><div style="padding-top:4px;font-size:14px;font-weight:600;line-height:1.5;color:#302d29">${escapeHtml(ticket.subject)}</div><div style="padding-top:11px;font-size:12px;color:#756d65">${escapeHtml(status)} · ${escapeHtml(formatDate(status === "Resolved" ? ticket.updatedAt : ticket.createdAt))}</div></td></tr></table></td></tr><tr><td style="padding:16px 30px 25px"><div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#9c7660">YOUR MESSAGE</div><div style="margin-top:8px;padding:13px 15px;border-left:3px solid #e96822;border-radius:0 8px 8px 0;background:#faf9f7;color:#514a44;font-size:13px;line-height:1.65">${detailText}</div><p style="margin:20px 0 0;color:#655d55;font-size:13px;line-height:1.6">${status === "Resolved" ? "If you still need help, reply to this email and our team will be happy to assist." : "Our team will review your request and follow up by email. Please keep your ticket reference for future correspondence."}</p></td></tr><tr><td style="padding:15px 30px;border-top:1px solid #eee9e3;background:#fcfbfa;color:#8b837b;font-size:11px;line-height:1.5">${escapeHtml(shopName)} · This is an automatic confirmation from the store support team.</td></tr></table></td></tr></table></body></html>`;
}

async function sendTicketEmail(ticket, kind) {
  if (!ticket?.email) return { sent: false, skipped: true, reason: "Customer email is not available." };
  const mail = getTransport();
  if (!mail) return { sent: false, skipped: true, reason: "SMTP environment variables are not configured." };
  const shopName = String(ticket.shop || "Store").replace(/\.myshopify\.com$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const resolved = kind === "resolved";
  const subject = resolved ? `Support request ${ticket.reference} has been resolved` : `We received your support request · ${ticket.reference}`;
  const greeting = resolved
    ? `Your support request with ${shopName} has been marked as resolved.`
    : `We have received your support request with ${shopName}. Your ticket has been created and our team will review it.`;
  const status = resolved ? "Resolved" : "Open";
  const text = `${subject}\n\nHello ${ticket.customer || "there"},\n\n${greeting}\n\nTicket: ${ticket.reference}\nSubject: ${ticket.subject}\nStatus: ${status}\nSubmitted: ${formatDate(ticket.createdAt)}\n\nYour message:\n${ticket.message || "No additional details were provided."}\n\n${resolved ? "If you still need help, reply to this email and our team will be happy to assist." : "Our team will review your request and follow up by email."}`;
  await mail.transport.sendMail({ from: mail.from, to: ticket.email, replyTo: mail.replyTo, subject, text, html: ticketEmailHtml({ title: resolved ? "Your request is resolved" : "We received your request", greeting, status, ticket, shopName }) });
  return { sent: true };
}

export const sendTicketCreatedEmail = (ticket) => sendTicketEmail(ticket, "created");
export const sendTicketResolvedEmail = (ticket) => sendTicketEmail(ticket, "resolved");
