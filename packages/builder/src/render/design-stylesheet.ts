/**
 * The element defaults a designed page needs on top of the site's own stylesheet: heading
 * sizes, lists, quotes, figures and menus. They apply only inside `.lintel-design` (the
 * wrapper the website and the canvas put a design in) and with `:where()`, so they never
 * outweigh a class the style panel sets.
 *
 * The built-in website adds this to its stylesheet, and the canvas draws with that same
 * stylesheet, so a design looks the same in both.
 */
import { elementStylesheet } from "./elements/element-stylesheet.js";

export const designClassName = "lintel-design";

const elementDefaults = `:where(.lintel-design) :where(h1, h2, h3, h4, h5, h6) {
  margin: 0;
  font-family: var(--lintel-font-heading);
  line-height: 1.15;
  letter-spacing: -0.01em;
}
:where(.lintel-design) :where(h1) { font-size: clamp(2.25rem, 5vw, 3.5rem); }
:where(.lintel-design) :where(h2) { font-size: clamp(1.75rem, 3.5vw, 2.5rem); }
:where(.lintel-design) :where(h3) { font-size: 1.375rem; }
:where(.lintel-design) :where(h4) { font-size: 1.125rem; }
:where(.lintel-design) :where(h5, h6) { font-size: 1rem; }
:where(.lintel-design) :where(p, ul, ol, figure, blockquote) { margin: 0; }
:where(.lintel-design) :where(ul, ol) { padding-left: 1.25em; }
:where(.lintel-design) :where(img) { display: block; max-width: 100%; }
:where(.lintel-design) :where(figure img) { width: 100%; height: auto; border-radius: inherit; }
:where(.lintel-design) :where(figcaption) {
  margin-top: var(--lintel-space-2);
  font-size: 0.875rem;
  color: var(--lintel-color-text-secondary);
}
:where(.lintel-design) :where(nav ul) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lintel-space-5);
  padding: 0;
  list-style: none;
}
:where(.lintel-design) :where(nav a) { color: inherit; text-decoration: none; }
:where(.lintel-design) :where(hr) { margin: 0; border: 0; }
`;

/** The element defaults and the element library's own styles (see elements/). */
export const designBaseStylesheet = `${elementDefaults}\n${elementStylesheet}\n`;
