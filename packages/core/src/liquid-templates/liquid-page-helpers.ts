import type { MenuItem } from "@lintel/site-components";

/**
 * What Lintel's own tags need from the page being drawn: its menus, forms and design, and
 * the shared document's parts. Made for each page by liquid-pages.service.ts and handed to
 * the tags through the `lintel` global, which templates can't read anything from.
 */
export interface LiquidPageHelpers {
  /** A menu by handle, in the page's language, with the current page marked. */
  menu(handle: string): Promise<MenuItem[]>;
  /** A form by handle, drawn as the builder's Form element draws it; "" when there's none. */
  form(handle: string, options: { showTitle: boolean }): Promise<string>;
  /** The entry's visual design, drawn; "" when it has none. */
  design(): string;
  /** A marker `{% lintel_head %}` writes; the `<head>` takes its place once the page is drawn. */
  headMarker: string;
  header: string;
  footer: string;
  /** A "Cookie settings" button, on sites with the cookie notice; "" on others. */
  cookieSettings: string;
}

const helpersByGlobal = new WeakMap<object, LiquidPageHelpers>();

/** The `lintel` global for one page: an empty object the page's helpers are found by. */
export function createLintelGlobal(helpers: LiquidPageHelpers): object {
  const lintel = Object.freeze({});
  helpersByGlobal.set(lintel, helpers);
  return lintel;
}

/** The helpers of the page a tag is drawn in, or undefined outside a page (a test). */
export function findPageHelpers(globals: unknown): LiquidPageHelpers | undefined {
  if (typeof globals !== "object" || globals === null || !("lintel" in globals)) return undefined;
  const lintel = globals.lintel;
  return typeof lintel === "object" && lintel !== null ? helpersByGlobal.get(lintel) : undefined;
}
