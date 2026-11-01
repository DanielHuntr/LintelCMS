/**
 * The element defaults a designed page needs on top of the site's own stylesheet: heading
 * sizes, lists, quotes, figures and menus. They apply only inside `.lintel-design` (the
 * wrapper the website and the canvas put a design in) and with `:where()`, so they never
 * outweigh a class the style panel sets.
 *
 * The built-in website adds this to its stylesheet, and the canvas draws with that same
 * stylesheet, so a design looks the same in both.
 */
export const designClassName = "lintel-design";

export const designBaseStylesheet = `:where(.lintel-design) :where(h1, h2, h3, h4, h5, h6) {
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
/* As specific as the site's own "a" rule and after it, so menus take their colour from the menu. */
:where(.lintel-design nav) a { color: inherit; text-decoration: none; }
:where(.lintel-design) :where(hr) { margin: 0; border: 0; }
:where(.lintel-design) .lintel-video-background {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
:where(.lintel-design) .lintel-video-background video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
:where(.lintel-design) .lintel-video-background::after {
  content: "";
  position: absolute;
  inset: 0;
}
:where(.lintel-design) .lintel-video-toggle {
  position: absolute;
  right: var(--lintel-space-3);
  bottom: var(--lintel-space-3);
  z-index: 1;
  padding: 0.25rem 0.75rem;
  font: inherit;
  font-size: 0.8125rem;
  color: #fff;
  background: rgb(0 0 0 / 0.55);
  border: 0;
  border-radius: 999px;
  pointer-events: auto;
  cursor: pointer;
}
`;
