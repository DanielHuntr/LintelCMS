import { UnsafeSvgError } from "./media.errors.js";

/**
 * SVG files are documents that browsers run: one opened from Lintel's address could carry a
 * script that acts as the signed-in editor. So uploads that contain anything active are
 * refused outright, rather than cleaned, because a cleaner that misses one trick is worse
 * than a clear "no". Files are also served with a strict Content-Security-Policy, in case.
 *
 * Character references (`&#106;avascript:`) are decoded before checking, since browsers
 * decode them too.
 */
const activeContentPatterns: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /<script[\s>/]/i, reason: "a script" },
  { pattern: /[\s/"']on[a-z]+\s*=/i, reason: "an event handler (such as onload)" },
  { pattern: urlSchemePattern("javascript"), reason: "a javascript: link" },
  { pattern: urlSchemePattern("vbscript"), reason: "a vbscript: link" },
  {
    pattern: /data\s*:\s*(text\/html|application\/(xhtml|javascript)|image\/svg)/i,
    reason: "embedded active content",
  },
  { pattern: /<foreignObject[\s>/]/i, reason: "embedded HTML (foreignObject)" },
  {
    pattern: /<(iframe|embed|object|applet|meta|base)[\s>/]/i,
    reason: "an embedded page or plugin",
  },
  { pattern: /<!ENTITY/i, reason: "XML entities" },
  { pattern: /<\?xml-stylesheet/i, reason: "an external stylesheet" },
  { pattern: /@import/i, reason: "an imported stylesheet" },
];

/** Browsers ignore tabs and line breaks inside a URL scheme, so "java\tscript:" still runs. */
function urlSchemePattern(scheme: string): RegExp {
  return new RegExp(`${scheme.split("").join("\\s*")}\\s*:`, "i");
}

export function assertSvgIsSafe(svgText: string, filename: string): void {
  const decoded = decodeCharacterReferences(svgText);
  for (const { pattern, reason } of activeContentPatterns) {
    if (pattern.test(decoded)) {
      throw new UnsafeSvgError(filename, reason);
    }
  }
}

/** Whether an SVG reaches for a file elsewhere, which is why some can't be opened here. */
export function linksOutside(svgText: string): boolean {
  return /href\s*=\s*["']\s*(https?:)?\/\//i.test(svgText);
}

function decodeCharacterReferences(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) => codePointToText(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_match, decimal: string) => codePointToText(parseInt(decimal, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, "");
}

function codePointToText(codePoint: number): string {
  // Out-of-range references are left as something that can't match a pattern.
  return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "�";
}
