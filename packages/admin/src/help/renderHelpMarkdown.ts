import { Marked, type Tokens } from "marked";
import { fullDocsUrl } from "./docsLinks.js";

/**
 * Turns a docs page's Markdown into HTML for the help panel. The Markdown comes from this
 * repository (bundled at build time, never fetched), so it is trusted like the admin's own
 * code. What differs from the docs site:
 *
 *   - links to other "Using Lintel" pages stay inside the panel (`data-help-slug`);
 *   - other docs links open the full docs in a new tab;
 *   - screenshots point at the copies bundled with the admin, found by file name;
 *   - headings get the same ids as on the docs site, so `#anchors` work.
 */

export interface RenderOptions {
  /** Bundled screenshot URLs by file name ("media-library.png"). */
  screenshots: Readonly<Record<string, string>>;
  /** Defaults to VITE_DOCS_URL; see docsLinks.ts. */
  docsSiteUrl?: string;
  /**
   * The level of the page's own title, so the page's headings sit below it: 2 in the
   * panel (whose title is an h2), 1 on the Help screen (an h1). Defaults to 2.
   */
  titleLevel?: 1 | 2;
}

/** The anchor id the docs site gives a heading: lowercase, punctuation dropped, dashes. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** Tags without attributes that only change how text looks. */
const PLAIN_TAG = /^<\/?(kbd|br|strong|em|code|sub|sup|p)\s*\/?>$/i;

export function renderHelpMarkdown(markdown: string, options: RenderOptions): string {
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }: Tokens.Heading) {
        const content = this.parser.parseInline(tokens);
        // Docs pages start at h2 under their h1 title; shift them to sit under this title.
        const level = Math.min(depth - 1 + (options.titleLevel ?? 2), 6);
        return `<h${level} id="${headingId(text)}">${content}</h${level}>\n`;
      },
      // The docs are ours, but the panel runs inside the admin with an editor's session, so
      // raw HTML is shown as text, apart from a few plain tags such as <kbd>, and links
      // can't be javascript: or data: addresses.
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return PLAIN_TAG.test(text.trim()) ? text : escapeAttribute(text);
      },
      link({ href, title, tokens }: Tokens.Link) {
        const content = this.parser.parseInline(tokens);
        if (!isSafeLink(href)) return content;
        const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
        const helpSlug = /^\/(using(?:\/[^#]*)?)$/.exec(href.split("#")[0] ?? "");
        if (helpSlug?.[1] !== undefined) {
          const slug = helpSlug[1].replace(/\/+$/, "");
          const anchor = href.split("#")[1] ?? "";
          return `<a href="${escapeAttribute(fullDocsUrl(href, options.docsSiteUrl))}" data-help-slug="${escapeAttribute(slug)}" data-help-anchor="${escapeAttribute(anchor)}"${titleAttribute}>${content}</a>`;
        }
        const external = href.startsWith("/") ? fullDocsUrl(href, options.docsSiteUrl) : href;
        return `<a href="${escapeAttribute(external)}" target="_blank" rel="noopener noreferrer"${titleAttribute}>${content}</a>`;
      },
      image({ href, text }: Tokens.Image) {
        const fileName = href.split("/").at(-1) ?? "";
        const source = options.screenshots[fileName];
        // A screenshot not bundled yet is left out rather than shown broken.
        if (!source) return "";
        return `<img src="${escapeAttribute(source)}" alt="${escapeAttribute(text)}" loading="lazy" />`;
      },
    },
  });
  return marked.parse(markdown, { async: false });
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Web and email addresses, and paths and anchors within the docs. */
function isSafeLink(href: string): boolean {
  return /^(https?:|mailto:|\/|#)/i.test(href.trim()) || !/^[a-z][a-z0-9+.-]*:/i.test(href.trim());
}
