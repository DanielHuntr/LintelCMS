import { z } from "zod";
import type { SourceFieldKind } from "./source-site.js";

/** The systems Settings → Import → Move your site to Lintel reads, besides WordPress. */
export const importSources = ["webflow", "framer", "statamic", "umbraco"] as const;
export type ImportSource = (typeof importSources)[number];

export const siteImportStatuses = ["ready", "running", "paused", "complete"] as const;
export type SiteImportStatus = (typeof siteImportStatuses)[number];

export const siteImportItemStatuses = ["pending", "done", "skipped", "failed"] as const;

/** What is brought in, in this order: everything comes after what it needs. */
export const siteImportItemKinds = [
  "taxonomy",
  "term",
  "contentType",
  "media",
  "entry",
  "menu",
  "global",
] as const;
export type SiteImportItemKind = (typeof siteImportItemKinds)[number];

/** What the files hold, counted when they are read, for the "We'll create..." preview. */
export interface SiteImportFound {
  contentTypes: Array<{
    key: string;
    name: string;
    handle: string;
    structure: "tree" | "dated" | "flat";
    entries: number;
    fields: Array<{ key: string; label: string; kind: SourceFieldKind }>;
  }>;
  taxonomies: Array<{ key: string; name: string; handle: string; terms: number }>;
  media: number;
  menus: number;
  globals: number;
  /** What can't be moved, in plain words. */
  notes: string[];
}

export interface SiteImportProgress {
  done: number;
  total: number;
}

const handle = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,63}$/, {
    error: "Handles use lowercase letters, numbers and underscores, and start with a letter",
  });

const contentTypeMappingSchema = z.object({
  /** The collection entries go into; null leaves this kind out. */
  collection: handle.nullable(),
  /** Make a new content type and collection with that handle, rather than use one here. */
  create: z.boolean().default(true),
  name: z.string().trim().min(1).max(100),
  /** Each source field's key and the field it goes into; null leaves it out. */
  fields: z.record(z.string(), handle.nullable()).default({}),
});

export const siteImportMappingSchema = z.object({
  contentTypes: z.record(z.string(), contentTypeMappingSchema).default({}),
  /** Each taxonomy's key and the taxonomy here it goes into (made if missing); null leaves it out. */
  taxonomies: z.record(z.string(), handle.nullable()).default({}),
  media: z.enum(["import", "skip"]).default("import"),
  /** Hosts pictures may be downloaded from besides the old site's own and its CDN. */
  mediaHosts: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .transform((host) => host.replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, ""))
        .pipe(
          z
            .string()
            .regex(/^[a-z0-9.-]+(:\d+)?$/, { error: "Write each address like cdn.example.com" }),
        ),
    )
    .max(20)
    .default([]),
  drafts: z.enum(["import", "skip"]).default("import"),
  redirects: z.boolean().default(true),
  menus: z.boolean().default(true),
  globals: z.boolean().default(true),
});

export type SiteImportMapping = z.infer<typeof siteImportMappingSchema>;
export type ContentTypeMapping = z.infer<typeof contentTypeMappingSchema>;

export const siteImportParamsSchema = z.object({ id: z.uuid() });
export const sourceParamsSchema = z.object({ source: z.enum(importSources) });

/** What an import did, or (for a dry run) would do. */
export interface SiteImportReport {
  dryRun: boolean;
  counts: Record<SiteImportItemKind, { done: number; skipped: number; failed: number }>;
  /** Content types and collections made for the import. */
  createdTypes: string[];
  /** Designed pages brought in as code blocks, so someone can check them. */
  designedPages: string[];
  renamedSlugs: Array<{ title: string; from: string; to: string }>;
  redirectsSuggested: number;
  /** Values that couldn't go into their field, so were left out. */
  fieldsLeftOut: Array<{ title: string; fields: string[] }>;
  /** What can't be moved, from reading the files. */
  notes: string[];
  problems: Array<{ kind: SiteImportItemKind; title: string; message: string }>;
}
