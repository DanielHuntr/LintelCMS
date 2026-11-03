import { emptySourceSite, type SourceSite } from "../source-site.js";
import { NotAnExportError } from "../site-import.errors.js";
import { readCsvCollection } from "./csv-collections.js";
import { designedPagesType, readHtmlPages } from "./html-pages.js";
import type { SourceFiles } from "./source-reader.js";

/**
 * Framer: each CMS collection's CSV export (in the CMS, the collection's menu → Export
 * CSV), and optionally a zip of pages saved from the published site.
 *
 * Framer has no code export, so pages are a best effort: the HTML of the published page,
 * as code blocks with editable text and pictures. Framer draws much of a page with
 * scripts, which never come across, so the report says plainly what to rebuild.
 */
export const FRAMER_MEDIA_HOSTS = ["framerusercontent.com"];

export async function readFramerExport(input: SourceFiles): Promise<SourceSite> {
  const site = emptySourceSite("Framer site");
  site.mediaHosts = FRAMER_MEDIA_HOSTS;
  const csvFiles = input.files.filter((file) => /\.csv$/i.test(file.filename));
  if (csvFiles.length === 0 && !input.archive) {
    throw new NotAnExportError("framer", "upload a collection's .csv export or a .zip of pages");
  }
  for (const file of csvFiles) {
    const read = readCsvCollection(file.filename, file.text, {
      systemColumns: [":draft", "Draft", "Created", "Updated"],
      oldPath: (collection, item) => `/${collection}/${item}`,
    });
    if ("problem" in read) throw new NotAnExportError("framer", read.problem);
    site.contentTypes.push(read.contentType);
    site.entries.push(...read.entries);
    site.media.push(...read.media.filter((media) => !site.media.some((m) => m.key === media.key)));
  }
  if (input.archive) {
    const pages = await readHtmlPages(input.archive, (path) => /(^|\/)404\.html?$/i.test(path));
    site.title = pages.siteTitle || site.title;
    if (pages.entries.length > 0) {
      site.contentTypes.unshift(designedPagesType);
      site.entries.push(...pages.entries);
      site.media.push(
        ...pages.media.filter((media) => !site.media.some((m) => m.key === media.key)),
      );
    }
  }
  site.notes.push(
    "Framer has no export for page designs. Pages saved from the published site come in as code blocks with editable text and pictures, but Framer's components, effects, animations, scroll and hover interactions, forms and anything drawn by scripts can't be moved; rebuild those with the builder.",
    "Collection pages' layouts (the design each CMS item is shown with) aren't in the export; design them in the builder.",
  );
  return site;
}
