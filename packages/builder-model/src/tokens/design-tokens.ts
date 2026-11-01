/**
 * The site's design tokens as the builder offers them: colours, spacing steps, corner radii
 * and fonts. They are CSS custom properties set by the site's theme (`--lintel-color-brand`),
 * so a style that uses one follows the theme when it changes. The names match the theme
 * stylesheet in `@lintel/site-components`.
 *
 * The style panel shows these as swatches and chips; what it stores is plain CSS,
 * `var(--lintel-color-brand)`, which reads the same in the code view.
 */

export interface DesignToken {
  /** The custom property, without the leading dashes: "lintel-color-brand". */
  name: string;
  /** Plain English for the style panel: "Brand". */
  label: string;
  /** What the canvas uses until the site's theme is loaded. */
  fallback: string;
}

function token(name: string, label: string, fallback: string): DesignToken {
  return { name: `lintel-${name}`, label, fallback };
}

export const colourTokens: readonly DesignToken[] = [
  token("color-text", "Text", "#1d1d1f"),
  token("color-text-secondary", "Soft text", "#6e6e73"),
  token("color-background", "Page", "#ffffff"),
  token("color-surface", "Panel", "#f5f5f7"),
  token("color-border", "Lines", "#d2d2d7"),
  token("color-brand", "Brand", "#7539fd"),
  token("color-on-brand", "On brand", "#ffffff"),
  token("color-accent", "Accent", "#0a6fd6"),
];

/** Nine steps, small to large; the theme's spacing choice scales them all. */
export const spacingTokens: readonly DesignToken[] = [
  token("space-1", "XXS", "0.25rem"),
  token("space-2", "XS", "0.5rem"),
  token("space-3", "S", "0.75rem"),
  token("space-4", "M", "1rem"),
  token("space-5", "L", "1.5rem"),
  token("space-6", "XL", "2rem"),
  token("space-7", "2XL", "3rem"),
  token("space-8", "3XL", "4.5rem"),
  token("space-9", "4XL", "6rem"),
];

export const radiusTokens: readonly DesignToken[] = [
  token("radius-small", "Small", "6px"),
  token("radius-medium", "Medium", "12px"),
  token("radius-large", "Large", "18px"),
  token("radius-button", "Button", "10px"),
];

export const fontTokens: readonly DesignToken[] = [
  token(
    "font-heading",
    "Heading font",
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  ),
  token(
    "font-body",
    "Body font",
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  ),
];

export const designTokens: readonly DesignToken[] = [
  ...colourTokens,
  ...spacingTokens,
  ...radiusTokens,
  ...fontTokens,
];

/** The CSS value that uses a token: `var(--lintel-color-brand)`. */
export function tokenValue(tokenToUse: DesignToken): string {
  return `var(--${tokenToUse.name})`;
}

/** The token a value uses, if it is exactly `var(--name)`. */
export function findTokenByValue(
  value: string | undefined,
  tokens: readonly DesignToken[] = designTokens,
): DesignToken | undefined {
  const match = value?.match(/^var\(--([\w-]+)\)$/);
  return match ? tokens.find((candidate) => candidate.name === match[1]) : undefined;
}

/**
 * Every token with its fallback value, as a `:root` rule. The canvas uses it until the site's
 * own theme stylesheet replaces it, and tests use it for a predictable look.
 */
export function fallbackTokenStylesheet(): string {
  const declarations = designTokens.map((each) => `  --${each.name}: ${each.fallback};`);
  return `:root {\n${declarations.join("\n")}\n}`;
}
