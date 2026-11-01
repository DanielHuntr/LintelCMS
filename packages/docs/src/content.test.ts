import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readFrontmatter, slugFromPath } from "./help/help-page.js";
import { buildingPages, hostingPages, usingPages } from "./sidebar.js";

/**
 * Checks on the docs themselves, so a broken link, a missing screenshot or a page left out
 * of the sidebar fails the build instead of reaching a reader.
 */

const docsFolder = join(dirname(fileURLToPath(import.meta.url)), "content", "docs");

interface DocsFile {
  path: string;
  slug: string;
  fields: Record<string, string>;
  body: string;
}

function listMarkdownFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((item) => {
    const path = join(folder, item.name);
    if (item.isDirectory()) return listMarkdownFiles(path);
    return /\.mdx?$/.test(item.name) ? [path] : [];
  });
}

const docsFiles: DocsFile[] = listMarkdownFiles(docsFolder).map((path) => {
  const { fields, body } = readFrontmatter(readFileSync(path, "utf8"));
  return { path, slug: slugFromPath(`content/docs/${relative(docsFolder, path)}`), fields, body };
});

const docsBySlug = new Map(docsFiles.map((file) => [file.slug, file]));
const sectionPages = docsFiles.filter((file) => file.slug !== "");

/** The anchor ids Starlight gives headings: lowercase, punctuation dropped, spaces as dashes. */
function headingAnchors(body: string): Set<string> {
  const anchors = new Set<string>();
  for (const match of body.matchAll(/^#{2,6}\s+(.+)$/gm)) {
    const anchor = (match[1] ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    anchors.add(anchor);
  }
  return anchors;
}

describe("the docs pages", () => {
  it("each have a title and a one-line description", () => {
    for (const file of docsFiles) {
      expect(file.fields.title, file.path).toBeTruthy();
      expect(file.fields.description, file.path).toBeTruthy();
    }
  });

  it("each say which Lintel version introduced them", () => {
    for (const file of sectionPages) {
      expect(file.fields.since, file.path).toMatch(/^\d+\.\d+$/);
    }
  });

  it("are all in the sidebar, and the sidebar lists only pages that exist", () => {
    const listed = [...usingPages, ...buildingPages, ...hostingPages];
    expect([...listed].sort()).toEqual(sectionPages.map((file) => file.slug).sort());
  });
});

describe("links between pages", () => {
  const links = docsFiles.flatMap((file) =>
    [...file.body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((match) => ({
      from: file.path,
      href: match[1] ?? "",
    })),
  );

  it("are checked (there are some to check)", () => {
    expect(links.length).toBeGreaterThan(10);
  });

  it("point at pages and headings that exist", () => {
    for (const { from, href } of links) {
      const [path = "", anchor] = href.split("#");
      const target = docsBySlug.get(path.replace(/^\/|\/$/g, ""));
      expect(target, `${from} links to ${href}`).toBeDefined();
      if (target && anchor) {
        expect(headingAnchors(target.body), `${from} links to ${href}`).toContain(anchor);
      }
    }
  });

  it("end with a slash, as the docs site's addresses do", () => {
    for (const { from, href } of links) {
      expect(href.split("#")[0], `${from} links to ${href}`).toMatch(/\/$/);
    }
  });
});

describe("screenshots", () => {
  it("exist for every image a page shows, and every image has alt text", () => {
    for (const file of docsFiles) {
      for (const match of file.body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
        const [, alt, source = ""] = match;
        expect(alt, `${file.path}: ${source}`).toBeTruthy();
        expect(existsSync(resolve(dirname(file.path), source)), `${file.path}: ${source}`).toBe(
          true,
        );
      }
    }
  });
});
