import createDOMPurify, { type DOMPurify } from "dompurify";
import { JSDOM } from "jsdom";

/**
 * Takes everything that can run JavaScript out of a code block's HTML when a page is saved
 * under the site's "remove scripts" rule (see builder-model's sanitise-code.ts for the rule).
 *
 * The builder's own cleaner is small enough for the browser, where the canvas is sandboxed
 * anyway, but it parses HTML its own way, and HTML that a browser reads differently (a comment
 * written `<!-->`, `</style/>`, a `<style>` inside an `<svg>`) slipped past it. This one
 * parses with jsdom, the way a browser does, and keeps only what DOMPurify knows is safe.
 */
export function removeScriptsFromCodeHtml(html: string): string {
  return purifier().sanitize(html, {
    // Code blocks are often embeds (videos, maps), so frames stay, without `srcdoc`.
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy", "target"],
    FORBID_TAGS: ["base", "link", "meta", "noscript"],
    FORBID_ATTR: ["srcdoc"],
  });
}

let created: DOMPurify | undefined;

/** Made on first use: a jsdom window takes a moment, and most requests never need one. */
function purifier(): DOMPurify {
  created ??= createDOMPurify(new JSDOM("").window);
  return created;
}
