/**
 * Which help page the "?" button opens on each screen. The first pattern that matches the
 * address wins, so more specific screens come first. Slugs are docs pages under
 * packages/docs/src/content/docs (see helpTopics.test.ts, which checks that each exists).
 */
const helpTopics: ReadonlyArray<{ path: RegExp; slug: string }> = [
  { path: /^\/$/, slug: "using/getting-around" },
  { path: /^\/content(\/|$)/, slug: "using/writing" },
  { path: /^\/media(\/|$)/, slug: "using/media" },
  { path: /^\/settings\/security-log(\/|$)/, slug: "using/users" },
  { path: /^\/forms(\/|$)/, slug: "using/forms" },
  { path: /^\/settings(\/|$)/, slug: "using/content-types" },
  { path: /^\/users(\/|$)/, slug: "using/users" },
  { path: /^\/account(\/|$)/, slug: "using/users" },
];

/** The help index, for screens without a page of their own. */
export const HELP_HOME_SLUG = "using";

export function helpSlugForPath(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return helpTopics.find((topic) => topic.path.test(path))?.slug ?? HELP_HOME_SLUG;
}

export function allHelpTopicSlugs(): string[] {
  return [...new Set([HELP_HOME_SLUG, ...helpTopics.map((topic) => topic.slug)])];
}
