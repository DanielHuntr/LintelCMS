import { emptySourceSite, type SourceSite } from "../source-site.js";
import { NotAnExportError } from "../site-import.errors.js";
import { readCsvCollection } from "./csv-collections.js";
import { designedPagesType, readHtmlPages } from "./html-pages.js";
import type { SourceFiles } from "./source-reader.js";

/**
 * Webflow: each CMS collection's CSV export (Collection → Export), and optionally the
 * site's code export (Site settings → Export code), a zip of its pages, CSS and pictures.
 *
 * Collections become content types. Pages become designed pages, as code blocks with
 * their text and pictures editable (see designed-pages.ts). Collection template pages
 * ("detail_blog-posts.html") are designs for every item, which the builder makes in its
 * own way, so they're listed as not brought in.
 */
export const WEBFLOW_MEDIA_HOSTS = [
  "uploads-ssl.webflow.com",
  "cdn.prod.website-files.com",
  "assets.website-files.com",
  "global-uploads.webflow.com",
];

const systemColumns = [
  "Collection ID",
  "Locale ID",
  "Item ID",
  "Archived",
  "Draft",
  "Created On",
  "Updated On",
  "Published On",
];

export async function readWebflowExport(input: SourceFiles): Promise<SourceSite> {
  const site = emptySourceSite("Webflow site");
  site.mediaHosts = WEBFLOW_MEDIA_HOSTS;
  const csvFiles = input.files.filter((file) => /\.csv$/i.test(file.filename));
  if (csvFiles.length === 0 && !input.archive) {
    throw new NotAnExportError("webflow", "upload a collection's .csv export or the site's .zip");
  }
  for (const file of csvFiles) {
    const read = readCsvCollection(file.filename, file.text, {
      systemColumns,
      oldPath: (collection, item) => `/${collection}/${item}`,
    });
    if ("problem" in read) throw new NotAnExportError("webflow", read.problem);
    site.contentTypes.push(read.contentType);
    site.entries.push(...read.entries);
    site.media.push(...read.media.filter((media) => !site.media.some((m) => m.key === media.key)));
  }
  if (input.archive) {
    const pages = await readHtmlPages(
      input.archive,
      (path) => /(^|\/)detail_[^/]*\.html?$/i.test(path) || /(^|\/)(401|404)\.html?$/i.test(path),
    );
    if (pages.entries.length === 0) {
      throw new NotAnExportError("webflow", "the zip has no .html pages in it");
    }
    site.title = pages.siteTitle || site.title;
    site.contentTypes.unshift(designedPagesType);
    site.entries.push(...pages.entries);
    site.media.push(...pages.media.filter((media) => !site.media.some((m) => m.key === media.key)));
    if (pages.leftOut.length > 0) {
      site.notes.push(
        `These pages weren't brought in: ${pages.leftOut.join(", ")}. Collection templates and error pages are designed in Lintel's builder instead.`,
      );
    }
    site.notes.push(
      "Pages come in as code blocks that look like the original, with their text and pictures editable in the Content panel. Interactions, animations, forms and scripts don't come across; rebuild them with the builder's own elements.",
    );
  }
  site.notes.push(
    "Reference fields come in as text (the item's slug), and Webflow's e-commerce products aren't part of a CMS export.",
  );
  return site;
}
