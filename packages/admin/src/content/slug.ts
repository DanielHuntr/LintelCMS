/**
 * Slugs are the last part of an entry's web address: "My first post!" becomes "my-first-post".
 * The API makes the final slug unique; this is the preview the editor shows while typing.
 */

const maximumSlugLength = 80;

export function slugFromTitle(title: string): string {
  return (
    title
      .normalize("NFKD")
      // Accents split off by NFKD ("é" → "e" + "́") are dropped, keeping the letter.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maximumSlugLength)
      .replace(/-+$/, "")
  );
}

/** What someone may type into the slug box: the same rules, but a trailing hyphen can stay while typing. */
export function cleanTypedSlug(typed: string): string {
  return slugFromTitle(typed.replace(/\s/g, "-")) + (/[-\s]$/.test(typed) ? "-" : "");
}

/**
 * The address an entry will have on the site, e.g. "/blog/my-first-post" from "/blog/{slug}".
 * `{path}` (the page's place in the tree) is shown as the slug alone; the saved page's real
 * address comes from the server.
 */
export function entryUrlPreview(routePattern: string, slug: string): string {
  return slugPattern(routePattern).replace("{slug}", slug);
}

/** A route pattern with `{path}` read as `{slug}`, for showing where the slug goes. */
export function slugPattern(routePattern: string): string {
  return routePattern.replace("{path}", "{slug}");
}
