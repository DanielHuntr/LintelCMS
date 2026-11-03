import { colourTokens, tokenValue } from "@lintel/builder-model";
import type { CursorColourSwatch } from "@lintel/motion-editor";
import { useSiteTokens } from "../site-design/site-design-context.js";

/** The theme colours worth offering for the cursor's word; lines and soft text aren't. */
const themeNames = new Set([
  "lintel-color-text",
  "lintel-color-background",
  "lintel-color-surface",
  "lintel-color-brand",
  "lintel-color-accent",
]);

/** The site's own colours first, then the theme's, as swatches for the cursor's word. */
export function useCursorColourSwatches(): CursorColourSwatch[] {
  const siteColours = useSiteTokens("colour");
  return [...siteColours, ...colourTokens.filter((token) => themeNames.has(token.name))].map(
    (token) => ({
      value: tokenValue(token),
      label: token.label,
      swatch: `var(--${token.name}, ${token.fallback})`,
    }),
  );
}
