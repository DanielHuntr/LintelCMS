/**
 * What every importer reads another system's files into: one shape for Webflow, Framer,
 * Statamic and Umbraco, so the mapping screen, the dry run, the import and the report work
 * the same for all of them. Each source's reader (src/importers/sources) fills it in; the
 * rest of the importer never looks at the original files again, except for pictures, which
 * are read from the uploaded zip (or downloaded) while the import runs.
 *
 * Keys (`key`, `typeKey`, `parentKey`...) are the source's own ids, as text. They're only
 * used to connect things within one import.
 */
export const sourceFieldKinds = [
  "text",
  "textarea",
  "richText",
  "markdown",
  "number",
  "toggle",
  "date",
  "image",
  "images",
  "url",
  "email",
  "colour",
  "select",
  "terms",
  "entries",
  "code",
  "video",
  "list",
  "design",
] as const;
export type SourceFieldKind = (typeof sourceFieldKinds)[number];

export interface SourceField {
  key: string;
  label: string;
  kind: SourceFieldKind;
  /** For `select`: the values offered. */
  choices?: string[];
  /** For `select`: more than one may be chosen. */
  multiple?: boolean;
  /** For `terms`: which taxonomy. Values name terms as "<taxonomy key>/<term key>". */
  taxonomyKey?: string;
  /** For `entries`: which content types' entries. */
  typeKeys?: string[];
}

export interface SourceContentType {
  key: string;
  name: string;
  /** The handle it would get here, such as `blog_posts`. */
  handle: string;
  structure: "tree" | "dated" | "flat";
  /** Where its entries live on the new site, without the slug: "/blog", or "" for "/{slug}". */
  routePrefix: string;
  fields: SourceField[];
  /** For trees: the content types whose entries may sit under one of these. */
  allowedChildren?: string[];
  /** For trees: whether its entries may sit at the top. */
  allowedAtRoot?: boolean;
}

/** A page designed on the old site: its HTML and CSS, with the pictures it shows. */
export interface DesignValue {
  html: string;
  css: string;
  /** Each picture's address in the HTML, and the media key it will come in as. */
  pictures: Record<string, string>;
}

export type SourceValue = string | number | boolean | null | string[] | DesignValue;

export interface SourceEntry {
  key: string;
  typeKey: string;
  title: string;
  slug: string;
  parentKey: string | null;
  /** Its place among its siblings. */
  order: number;
  published: boolean;
  /** When it was published (or written), as an ISO date and time. */
  date: string | null;
  /** Its address on the old site, for a redirect: "/blog/spring-sale". */
  oldPath: string | null;
  values: Record<string, SourceValue>;
}

export interface SourceMedia {
  key: string;
  filename: string;
  alt: string;
  /** Where it is in the uploaded zip, or else */
  archivePath?: string;
  /** where to download it from. */
  url?: string;
}

export interface SourceTerm {
  key: string;
  title: string;
  slug: string;
  description: string;
}

export interface SourceTaxonomy {
  key: string;
  name: string;
  handle: string;
  terms: SourceTerm[];
}

export interface SourceMenuLink {
  label: string;
  entryKey: string | null;
  url: string | null;
  children: SourceMenuLink[];
}

export interface SourceMenu {
  key: string;
  name: string;
  links: SourceMenuLink[];
}

/** Site-wide values: Statamic globals, Umbraco dictionary items. */
export interface SourceGlobalSet {
  key: string;
  name: string;
  handle: string;
  fields: SourceField[];
  values: Record<string, SourceValue>;
}

export interface SourceSite {
  title: string;
  /** The old site's address, if the files say: "https://example.com". */
  address: string;
  contentTypes: SourceContentType[];
  taxonomies: SourceTaxonomy[];
  media: SourceMedia[];
  entries: SourceEntry[];
  menus: SourceMenu[];
  globals: SourceGlobalSet[];
  /** What can't be moved, in plain words, shown before and after importing. */
  notes: string[];
  /** Hosts pictures may be downloaded from besides the old site's own (a CDN). */
  mediaHosts: string[];
}

export function emptySourceSite(title: string): SourceSite {
  return {
    title,
    address: "",
    contentTypes: [],
    taxonomies: [],
    media: [],
    entries: [],
    menus: [],
    globals: [],
    notes: [],
    mediaHosts: [],
  };
}
