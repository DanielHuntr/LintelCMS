import type { PageNode } from "@lintel/builder-model";

/**
 * Elements that need the elements script on the published page (sliders, tabs, pop-ups,
 * the basket...). Everything else is plain HTML and CSS, so most pages load no script.
 */
export const behaviourTypes: ReadonlySet<string> = new Set([
  "tabs",
  "accordion",
  "modal",
  "carousel",
  "testimonialSlider",
  "gallery",
  "video",
  "map",
  "embed",
  "beforeAfter",
  "counter",
  "countdown",
  "siteHeader",
  "mobileMenu",
  "backToTop",
  "languageSwitcher",
  "formEmbed",
  "newsletterSignup",
  "productGrid",
  "productCard",
  "productGallery",
  "variantPicker",
  "addToCart",
  "cartDrawer",
  "cartContents",
  "checkoutButton",
  "orderConfirmation",
]);

export function usesBehaviours(node: PageNode): boolean {
  if (node.hidden) return false;
  return behaviourTypes.has(node.type) || node.children.some(usesBehaviours);
}

/** Joins class names, leaving out empty ones. */
export function cx(...names: ReadonlyArray<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
