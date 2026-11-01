import { posix } from "node:path";
import { attributeOf, parseHtml, textContent, walkElements } from "@lintel/builder-model";
import type { ZipArchiveReader } from "../../archives/zip-reader.js";
import { slugify } from "../../entries/slugs.js";
import { listArchiveFiles, readArchiveText } from "../import-archives.js";
import type { SourceContentType, SourceEntry, SourceMedia } from "../source-site.js";
import { rememberPicture } from "./csv-collections.js";

/**
 * The pages of a published site saved as HTML (Webflow's "Export code" zip, or pages saved
 * from a Framer site), as designed pages: see designed-pages.ts for how each becomes code
 * blocks with editable text and pictures. Every stylesheet in the zip is kept with them.
 *
 * Each file is a page at the address its name gives: index.html is "/", about.html is
 * "/about", shop/index.html is "/shop" and shop/gloves.html "/shop/gloves", under the
 * shop page when there is one. Pictures in the zip come in from it; pictures on the old
 * site's CDN are downloaded.
 */
export const designedPagesType: SourceContentType = {
  key: "pages",
  name: "Pages",
  handle: "pages",
  structure: "tree",
  routePrefix: "",
  fields: [{ key: "design", label: "Design", kind: "design" }],
};

export interface HtmlPages {
  entries: SourceEntry[];
  media: SourceMedia[];
  /** Pages that weren't brought in, and why. */
  leftOut: string[];
  siteTitle: string;
}

const MAX_PAGES = 500;

export async function readHtmlPages(
  archive: ZipArchiveReader,
  isTemplate: (path: string) => boolean,
): Promise<HtmlPages> {
  const files = listArchiveFiles(archive);
  const css = await readStyles(archive, files);
  const media = new Map<string, SourceMedia>();
  const leftOut: string[] = [];
  const pagePaths = [...files.keys()]
    .filter((path) => /\.html?$/i.test(path))
    .sort((first, second) => depth(first) - depth(second) || indexFirst(first, second));

  const pages: Array<{ path: string; address: string; entry: SourceEntry }> = [];
  let siteTitle = "";
  for (const path of pagePaths.slice(0, MAX_PAGES)) {
    if (isTemplate(path)) {
      leftOut.push(path);
      continue;
    }
    const html = await readArchiveText(archive, files.get(path) ?? path);
    if (html === null) {
      leftOut.push(path);
      continue;
    }
    const nodes = parseHtml(html);
    const pictures: Record<string, string> = {};
    walkElements(nodes, (element) => {
      const src = element.tag === "img" ? attributeOf(element, "src") : undefined;
      if (!src || src.startsWith("data:")) return;
      const key = pictureKey(src, path, files, media);
      if (key) pictures[src] = key;
    });
    let title = "";
    walkElements(nodes, (element) => {
      if (element.tag === "title" && !title) title = textContent(element).trim();
    });
    const address = addressOf(path);
    if (address === "/" && !siteTitle) siteTitle = title;
    const name = title.split(/\s[|–—-]\s/)[0]?.trim() || posix.basename(address) || "Home";
    pages.push({
      path,
      address,
      entry: {
        key: `page:${address}`,
        typeKey: designedPagesType.key,
        title: name,
        slug: address === "/" ? "home" : slugify(posix.basename(address)),
        parentKey: null,
        order: pages.length,
        published: true,
        date: null,
        oldPath: address,
        values: { design: { html, css, pictures } },
      },
    });
  }
  if (pagePaths.length > MAX_PAGES) {
    leftOut.push(`${pagePaths.length - MAX_PAGES} more pages`);
  }
  const byAddress = new Set(pages.map((page) => page.address));
  for (const page of pages) {
    const parent = posix.dirname(page.address);
    if (page.address !== "/" && parent !== "/" && byAddress.has(parent)) {
      page.entry.parentKey = `page:${parent}`;
    }
  }
  return {
    entries: pages.map((page) => page.entry),
    media: [...media.values()],
    leftOut,
    siteTitle,
  };
}

function pictureKey(
  src: string,
  pagePath: string,
  files: Map<string, string>,
  media: Map<string, SourceMedia>,
): string | null {
  if (/^https?:\/\//i.test(src)) {
    try {
      return rememberPicture(src, media);
    } catch {
      return null;
    }
  }
  const clean = decodeURIComponent(src.split(/[?#]/)[0] ?? "");
  const logical = posix.normalize(
    clean.startsWith("/") ? clean.slice(1) : posix.join(posix.dirname(pagePath), clean),
  );
  const archivePath = files.get(logical);
  if (!archivePath) return null;
  const key = `file:${logical}`;
  if (!media.has(key)) {
    media.set(key, { key, filename: posix.basename(logical), alt: "", archivePath });
  }
  return key;
}

async function readStyles(archive: ZipArchiveReader, files: Map<string, string>): Promise<string> {
  const sheets: string[] = [];
  for (const path of [...files.keys()].filter((name) => name.endsWith(".css")).sort()) {
    const text = await readArchiveText(archive, files.get(path) ?? path);
    if (text) sheets.push(`/* ${path} */\n${text}`);
  }
  return sheets.join("\n");
}

/** "index.html" → "/", "about.html" → "/about", "shop/index.html" → "/shop". */
export function addressOf(path: string): string {
  const withoutExtension = path.replace(/\.html?$/i, "");
  const trimmed = withoutExtension.replace(/(^|\/)index$/i, "");
  return `/${trimmed}`.replace(/\/+$/, "") || "/";
}

function depth(path: string): number {
  return path.split("/").length;
}

function indexFirst(first: string, second: string): number {
  const isIndex = (path: string) => /(^|\/)index\.html?$/i.test(path);
  return Number(isIndex(second)) - Number(isIndex(first)) || first.localeCompare(second);
}
