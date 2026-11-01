import { z } from "zod";

export const wordpressImportStatuses = ["ready", "running", "paused", "complete"] as const;
export const wordpressImportItemStatuses = ["pending", "done", "skipped", "failed"] as const;
export const wordpressItemKinds = [
  "author",
  "category",
  "tag",
  "attachment",
  "image",
  "page",
  "post",
] as const;

export type WordPressImportStatus = (typeof wordpressImportStatuses)[number];
export type WordPressItemKind = (typeof wordpressItemKinds)[number];

/** What the export holds, counted when it is uploaded. */
export interface WordPressImportFound {
  posts: number;
  pages: number;
  attachments: number;
  authors: number;
  categories: number;
  tags: number;
  /** Things the importer doesn't bring in, such as menus or a shop's products, by type. */
  ignored: Record<string, number>;
}

export interface WordPressImportProgress {
  done: number;
  total: number;
}

const handleOrNull = z.string().trim().min(1).nullable();

/** The mapping screen's choices. Null for a collection or taxonomy means "don't import these". */
export const wordpressImportMappingSchema = z.object({
  postsCollection: handleOrNull.default("posts"),
  pagesCollection: handleOrNull.default("pages"),
  categoriesTaxonomy: handleOrNull.default("categories"),
  tagsTaxonomy: handleOrNull.default("tags"),
  /** Where images come from: the old site, the uploaded wp-content zip, or nowhere. */
  media: z
    .enum(["download", "zip", "skip"], { error: "Choose where images come from" })
    .default("download"),
  /**
   * Images are only downloaded from the old site's own address and these, such as a CDN
   * the old site used ("cdn.example.com"). Anything else is listed in the report instead.
   */
  mediaHosts: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        // People often paste a whole address; only the host name (and port) matters.
        .transform((host) => host.replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, ""))
        .pipe(
          z
            .string()
            .regex(/^[a-z0-9.-]+(:\d+)?$/, { error: "Write each address like cdn.example.com" }),
        ),
    )
    .max(20)
    .default([]),
  /** Add the old site's authors as people who are invited to set a password, or not at all. */
  authors: z.enum(["invite", "skip"]).default("invite"),
  /** Bring in drafts and pending posts as drafts, or leave them behind. */
  drafts: z.enum(["import", "skip"]).default("import"),
  /** Suggest a redirect from each old address to the new one. */
  redirects: z.boolean().default(true),
});

export type WordPressImportMapping = z.infer<typeof wordpressImportMappingSchema>;

export const importIdParamsSchema = z.object({ id: z.uuid() });

/** What an import did, or (for a dry run) would do. */
export interface WordPressImportReport {
  dryRun: boolean;
  counts: Record<WordPressItemKind, { done: number; skipped: number; failed: number }>;
  /** People added without a password; each needs one before they can sign in. */
  invitedPeople: Array<{ name: string; email: string }>;
  /** Blocks and shortcodes kept as HTML, by kind, across the whole import. */
  keptAsHtml: Record<string, number>;
  /** The posts and pages that have HTML blocks, so someone can check them. */
  entriesWithHtml: Array<{ title: string; kinds: string[] }>;
  renamedSlugs: Array<{ title: string; from: string; to: string }>;
  redirectsSuggested: number;
  problems: Array<{ kind: WordPressItemKind; title: string; message: string }>;
}
