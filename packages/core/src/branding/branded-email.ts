import type { PublicBranding } from "./branding.schema.js";

/**
 * The frame every email from the admin is sent in (invitations, password resets, form
 * notifications), so clients see their agency's name, logo and colour, never Lintel's
 * unless that's the branding. Each email supplies only its words.
 */
export interface BrandedEmailContent {
  /** Without the product name; it's added, as in "Reset your password · Acme Studio". */
  subject: string;
  heading: string;
  paragraphs: readonly string[];
  /** One button, such as "Choose a new password". */
  action?: { label: string; url: string };
}

export interface BrandedEmail {
  subject: string;
  /** The sender's display name, such as "Acme Studio". */
  fromName: string;
  html: string;
  text: string;
}

export function renderBrandedEmail(
  branding: PublicBranding,
  content: BrandedEmailContent,
): BrandedEmail {
  const { accent } = branding;
  const name = escapeHtml(branding.productName);
  // Email clients can't fetch data: URLs, so only a logo at a web address is shown.
  const logo = branding.logo?.startsWith("http")
    ? `<img src="${escapeHtml(branding.logo)}" alt="${name}" height="32" style="display:block;height:32px">`
    : `<strong style="font-size:17px;color:#1d1d1f">${name}</strong>`;
  const paragraphs = content.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`)
    .join("");
  const button = content.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${accent.fill};color:${accent.onFill};text-decoration:none;font-weight:600">${escapeHtml(content.action.label)}</a></p>`
    : "";
  const support = branding.supportEmail
    ? `<p style="margin:24px 0 0;font-size:13px;color:#6e6e73">Questions? Email <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color:${accent.text}">${escapeHtml(branding.supportEmail)}</a>.</p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1d1f;font-size:15px;line-height:22px"><div style="max-width:520px;margin:0 auto;padding:32px 24px">${logo}<div style="margin-top:24px;padding:28px;background:#ffffff;border-radius:12px"><h1 style="margin:0 0 16px;font-size:22px;line-height:28px">${escapeHtml(content.heading)}</h1>${paragraphs}${button}</div>${support}</div></body></html>`;

  const text = [
    content.heading,
    "",
    ...content.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(content.action ? [`${content.action.label}: ${content.action.url}`, ""] : []),
    ...(branding.supportEmail ? [`Questions? Email ${branding.supportEmail}.`] : []),
    `— ${branding.productName}`,
  ].join("\n");

  return {
    subject: `${content.subject} · ${branding.productName}`,
    fromName: branding.productName,
    html,
    text,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
