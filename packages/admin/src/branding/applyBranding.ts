import type { AccentShades } from "@lintel/core/accent-colours";
import type { PublicBranding } from "./branding.api.js";

const STYLE_ID = "lintel-branding";

/**
 * Puts the branding into the page itself: the accent colour tokens, the favicon and the
 * browser's theme colour. Everything else reads the branding through useBranding().
 */
export function applyBrandingToDocument(branding: PublicBranding): void {
  if (typeof document === "undefined") return;
  applyAccent(branding.isLintelDefault ? null : branding.accent);
  applyFavicon(branding.favicon);
  setMeta("theme-color", branding.accent.fill);
  setMeta("application-name", branding.productName);
  setMeta("apple-mobile-web-app-title", branding.productName);
}

/**
 * The accent tokens from styles.css, for both colour schemes. Unlayered, so they win over
 * the defaults in the base layer without !important.
 */
export function accentStyleSheet(accent: AccentShades): string {
  const light = `--color-accent: ${accent.text}; --color-accent-fill: ${accent.fill}; --color-accent-fill-hover: ${accent.fillHover}; --color-on-accent: ${accent.onFill};`;
  const dark = `--color-accent: ${accent.textDark};`;
  return [
    `:root, [data-color-scheme] { ${light} }`,
    `[data-color-scheme="dark"] { ${dark} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-color-scheme="light"]), [data-color-scheme]:not([data-color-scheme="light"]) { ${dark} } }`,
  ].join("\n");
}

function applyAccent(accent: AccentShades | null): void {
  const existing = document.getElementById(STYLE_ID);
  if (!accent) {
    existing?.remove();
    return;
  }
  const style = existing ?? document.head.appendChild(document.createElement("style"));
  style.id = STYLE_ID;
  style.textContent = accentStyleSheet(accent);
}

/** Lintel's icons are in index.html; a branded favicon replaces them all. */
function applyFavicon(favicon: string | null): void {
  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="apple-touch-icon"]',
  );
  for (const link of links) {
    if (!link.dataset.lintelHref) link.dataset.lintelHref = link.getAttribute("href") ?? "";
    link.href = favicon ?? link.dataset.lintelHref;
    if (favicon) {
      link.removeAttribute("type");
      link.removeAttribute("sizes");
    }
  }
}

function setMeta(name: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.head.appendChild(document.createElement("meta"));
    meta.name = name;
  }
  meta.content = content;
}
