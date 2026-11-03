/**
 * Which help page the "?" button opens on each screen. The first pattern that matches the
 * address wins, so more specific screens come first. Slugs are docs pages under
 * packages/docs/src/content/docs (see helpTopics.test.ts, which checks that each exists).
 */
const helpTopics: ReadonlyArray<{ path: RegExp; slug: string }> = [
  { path: /^\/$/, slug: "using/getting-around" },
  { path: /^\/content(\/|$)/, slug: "using/writing" },
  { path: /^\/media(\/|$)/, slug: "using/media" },
  { path: /^\/users\/activity(\/|$)/, slug: "using/users" },
  { path: /^\/forms(\/|$)/, slug: "using/forms" },
  { path: /^\/account\/language(\/|$)/, slug: "using/interface-languages" },
  { path: /^\/visitors(\/|$)/, slug: "using/visitors" },
  { path: /^\/experiments(\/|$)/, slug: "using/ab-testing" },
  { path: /^\/settings\/page-drafting(\/|$)/, slug: "using/page-drafting" },
  { path: /^\/settings\/site\/fonts(\/|$)/, slug: "using/fonts" },
  { path: /^\/settings\/site(\/|$)/, slug: "using/website" },
  { path: /^\/settings\/backups(\/|$)/, slug: "using/backups" },
  { path: /^\/settings\/privacy(\/|$)/, slug: "using/privacy" },
  { path: /^\/settings\/(updates|about)(\/|$)/, slug: "using/updating" },
  { path: /^\/build\/import\/wordpress(\/|$)/, slug: "using/wordpress" },
  { path: /^\/build\/import(\/|$)/, slug: "using/backups" },
  { path: /^\/build(\/|$)/, slug: "using/content-types" },
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
