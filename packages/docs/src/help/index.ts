/**
 * The "Using Lintel" pages, bundled for the admin's help panel. The admin imports this
 * through `@lintel/docs/help`; Vite reads the Markdown and screenshots at build time, so
 * help works offline and always matches the docs in the same commit.
 *
 * Only the "Using Lintel" pages are bundled: the help panel is for people using the admin.
 */
import { usingPages } from "../sidebar.js";
import { parseHelpPage, type HelpPage } from "./help-page.js";

export type { HelpPage } from "./help-page.js";

const markdownFiles = import.meta.glob<string>("../content/docs/using/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Screenshot URLs by file name ("media-library.png"), for the images the pages show. */
const screenshotFiles = import.meta.glob<string>("../assets/screens/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});

const pagesBySlug = new Map<string, HelpPage>(
  Object.entries(markdownFiles).map(([path, source]) => {
    const page = parseHelpPage(path, source);
    return [page.slug, page];
  }),
);

/** In sidebar order, so the help index reads like the docs. */
export const helpPages: readonly HelpPage[] = usingPages.flatMap((slug) => {
  const page = pagesBySlug.get(slug);
  return page ? [page] : [];
});

export function findHelpPage(slug: string): HelpPage | undefined {
  return pagesBySlug.get(slug);
}

export const helpScreenshots: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(screenshotFiles).map(([path, url]) => [path.split("/").at(-1) ?? path, url]),
);

/** Where the docs' own Markdown lives in the repository, for "Edit this page" style links. */
export const docsSourceFolder = "packages/docs/src/content/docs";
