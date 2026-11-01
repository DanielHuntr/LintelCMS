import type { ZipArchiveReader } from "../../archives/zip-reader.js";
import type { SourceSite } from "../source-site.js";

/**
 * What each system's reader is given: text files uploaded on their own (CSV exports, a
 * Delivery API answer) and an optional zip (a site export, a content folder). A reader only
 * reads; it never fetches anything the files point at.
 */
export interface SourceFiles {
  files: Array<{ filename: string; text: string }>;
  archive: ZipArchiveReader | null;
}

export type SourceReader = (files: SourceFiles) => Promise<SourceSite>;
