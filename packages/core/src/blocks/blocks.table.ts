import type {
  BlockProperty,
  BlockSource,
  ComponentVariants,
  PageNode,
} from "@lintel/builder-model";
import { integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";

/**
 * The site's own blocks (see README.md): a design, or a template from code, with properties
 * editors fill in. Pages keep only each instance's values; the design stays here, so
 * changing it changes every page that uses the block.
 *
 * `source` says who looks after it: "site" blocks are made and changed in the builder,
 * "code" blocks come from `content-model/blocks/` and are read-only in the admin. Blocks
 * from plugins aren't stored: they come from the plugin while it is switched on.
 */
export const blocksTable = pgTable(
  "blocks",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("square"),
    category: text("category").notNull().default(""),
    description: text("description").notNull().default(""),
    source: text("source").$type<Exclude<BlockSource, "plugin">>().notNull().default("site"),
    /** Field definitions, in the same shape as a blueprint's. */
    properties: jsonb("properties").$type<BlockProperty[]>().notNull().default([]),
    /** The design's one element, with bindings to properties. Null for code blocks. */
    design: jsonb("design").$type<PageNode>(),
    /** A code block's HTML template; null when it is a React component drawn by the server. */
    template: text("template"),
    /** Old property handles to new ones, so instances saved before a rename keep their values. */
    renamedProperties: jsonb("renamed_properties")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    /**
     * Its variants (Size: Small, Medium, Large...) and how each looks, as differences from the
     * design. Blocks saved before variants have none.
     */
    variants: jsonb("variants")
      .$type<ComponentVariants>()
      .notNull()
      .default({ properties: [], looks: [], clientsMayChoose: false }),
    /** Raised whenever the properties change, so caches can tell. */
    version: integer("version").notNull().default(1),
    ...timestamps(),
  },
  (table) => [uniqueIndex("blocks_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type BlockRow = typeof blocksTable.$inferSelect;
export type NewBlockRow = typeof blocksTable.$inferInsert;
