import type { SiteChrome } from "../site.types.js";
import type { PageDesign } from "../templates/view.types.js";

/**
 * The site's own navigation and footer, made in the builder (see site-sections/ in
 * @lintel/builder-model): drawn in place of the automatic header and footer, outside
 * `<main>`, on every page that doesn't hide them or bring its own.
 */

/** What goes where the header (or footer) goes: nothing, the site's section, or the automatic one. */
export type ChromeSlot = PageDesign | "automatic" | null;

export function chromeSlots(
  chrome: SiteChrome,
  design: PageDesign | null | undefined,
): { header: ChromeSlot; footer: ChromeSlot } {
  return {
    header: design?.ownHeader ? null : (chrome.navigationDesign ?? "automatic"),
    footer: design?.ownFooter ? null : (chrome.footerDesign ?? "automatic"),
  };
}

/** The designs drawn on one page, as one for the `<head>`: all their styles and scripts. */
export function mergePageDesigns(
  designs: ReadonlyArray<PageDesign | null | undefined>,
): PageDesign | null {
  const drawn = designs.filter((design): design is PageDesign => Boolean(design));
  if (drawn.length === 0) return null;
  if (drawn.length === 1) return drawn[0] ?? null;
  const unique = <Value,>(values: Value[]) => [...new Set(values)];
  return {
    html: "",
    css: unique(drawn.map((design) => design.css).filter(Boolean)).join("\n"),
    animations: drawn.flatMap((design) => design.animations),
    effects: drawn.flatMap((design) => design.effects ?? []),
    fontPreloads: unique(drawn.flatMap((design) => design.fontPreloads ?? [])),
    script: unique(drawn.map((design) => design.script ?? "").filter(Boolean)).join("\n"),
    usesBehaviours: drawn.some((design) => design.usesBehaviours === true),
    usesMotionApi: drawn.some((design) => design.usesMotionApi === true),
    ownHeader: drawn.some((design) => design.ownHeader === true),
    ownFooter: drawn.some((design) => design.ownFooter === true),
  };
}

/** The page's design with the site's sections it shows, for the `<head>`. */
export function headDesign(
  design: PageDesign | null | undefined,
  slots: { header: ChromeSlot; footer: ChromeSlot },
): PageDesign | null {
  const section = (slot: ChromeSlot) => (typeof slot === "object" ? slot : null);
  const merged = mergePageDesigns([design, section(slots.header), section(slots.footer)]);
  // The page's own choices about its header and footer stay the page's.
  return merged && design
    ? { ...merged, ownHeader: design.ownHeader, ownFooter: design.ownFooter }
    : merged;
}

/** One of the site's sections, in `.lintel-design` like a designed page, so it looks the same. */
export function SiteSection({ design }: { design: PageDesign }) {
  return (
    <div
      className="lintel-design lintel-site-section"
      data-lintel-component="site_section"
      dangerouslySetInnerHTML={{ __html: design.html }}
    />
  );
}
