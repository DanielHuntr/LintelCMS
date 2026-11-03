/**
 * The site's own values for the theme's tokens (`--lintel-color-accent: #b4532a;`), read
 * from its theme stylesheet, so small previews outside the canvas show the site's brand
 * rather than the tokens' default values. The first value of each wins: the light scheme's.
 * A token that only points at another (`var(--lintel-color-accent)`) takes that one's value.
 */
export function themeTokenValues(stylesheet: string): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  for (const [, name, value] of stylesheet.matchAll(/--(lintel-[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
    if (name && value && !values.has(name)) values.set(name, value.trim());
  }
  for (const [name, value] of values) {
    const pointsAt = /^var\(--(lintel-[\w-]+)\)$/.exec(value)?.[1];
    const target = pointsAt ? values.get(pointsAt) : undefined;
    if (target) values.set(name, target);
  }
  return values;
}
