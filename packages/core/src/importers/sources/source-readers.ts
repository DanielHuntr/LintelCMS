import type { ImportSource } from "../site-import.schema.js";
import { readFramerExport } from "./framer-reader.js";
import type { SourceReader } from "./source-reader.js";
import { readStatamicExport } from "./statamic-reader.js";
import { readUmbracoExport } from "./umbraco-reader.js";
import { readWebflowExport } from "./webflow-reader.js";

/** Each system's reader, in one visible list. WordPress has src/wordpress-import. */
export const sourceReaders: Record<ImportSource, SourceReader> = {
  webflow: readWebflowExport,
  framer: readFramerExport,
  statamic: readStatamicExport,
  umbraco: readUmbracoExport,
};
