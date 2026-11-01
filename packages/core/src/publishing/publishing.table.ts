import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";

export const publishTargetKinds = ["zip", "sftp", "ftp", "s3", "folder"] as const;
export type PublishTargetKind = (typeof publishTargetKinds)[number];

/**
 * How a form on the published site sends its answers: through the PHP companion uploaded
 * beside the site, straight to Lintel's API (when it is reachable from the internet), or
 * not at all.
 */
export const formDeliveryModes = ["bridge", "api", "none"] as const;
export type FormDeliveryMode = (typeof formDeliveryModes)[number];

/** Where a target's connection settings live; which ones apply depends on the kind. */
export interface PublishTargetOptions {
  host?: string;
  port?: number;
  username?: string;
  /** The folder the website goes in, such as `public_html`. */
  remoteFolder?: string;
  /**
   * Where the PHP companion keeps its settings and queue, relative to the website folder.
   * Outside the website (`../lintel-private`) whenever the host allows it.
   */
  privateFolder?: string;
  /** FTP only: "explicit" TLS (the default), "implicit" TLS, or "none" (plain FTP). */
  ftpSecurity?: "explicit" | "implicit" | "none";
  bucket?: string;
  region?: string;
  endpoint?: string;
  prefix?: string;
  /** Folder targets: a folder on the computer or server Lintel runs on. */
  folderPath?: string;
  /** The published site's address, such as https://www.example.com. */
  siteAddress?: string;
}

/**
 * A place the website is published to as files. Passwords and keys are sealed with the
 * server's secret key (see src/secrets) in `sealedSecrets` and never sent back.
 */
export const publishTargetsTable = pgTable(
  "publish_targets",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    kind: text("kind", { enum: publishTargetKinds }).notNull(),
    options: jsonb("options").$type<PublishTargetOptions>().notNull().default({}),
    sealedSecrets: text("sealed_secrets"),
    formDelivery: text("form_delivery", { enum: formDeliveryModes }).notNull().default("bridge"),
    /** Publish a minute or so after content is published. */
    publishAutomatically: boolean("publish_automatically").notNull().default(false),
    /** More deletions than this in one publish wait for someone to confirm. */
    deleteLimit: integer("delete_limit").notNull().default(50),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index("publish_targets_tenant_idx").on(table.tenantId)],
);

export const publishRunStatuses = ["running", "succeeded", "failed", "needsConfirmation"] as const;
export type PublishRunStatus = (typeof publishRunStatuses)[number];

export const publishRunTriggers = ["manual", "automatic", "command"] as const;
export type PublishRunTrigger = (typeof publishRunTriggers)[number];

export interface PublishRunSummary {
  pagesRebuilt: number;
  pagesUnchanged: number;
  /** At most a couple of hundred of each, so the history stays small. */
  uploaded: string[];
  deleted: string[];
  uploadedCount: number;
  deletedCount: number;
  /** Deletions held back for confirmation. */
  deletionsWaiting: number;
  warnings: string[];
  formsPulled: number;
  ordersPulled: number;
}

/** One publish: when, why, what changed, and what went wrong in plain English. */
export const publishRunsTable = pgTable(
  "publish_runs",
  {
    id: id(),
    tenantId: tenantId(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => publishTargetsTable.id, { onDelete: "cascade" }),
    trigger: text("trigger", { enum: publishRunTriggers }).notNull(),
    status: text("status", { enum: publishRunStatuses }).notNull().default("running"),
    dryRun: boolean("dry_run").notNull().default(false),
    summary: jsonb("summary").$type<PublishRunSummary | null>(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("publish_runs_target_idx").on(table.tenantId, table.targetId, table.startedAt)],
);

/**
 * What the PHP companion on a published site has sent back, so each submission or order
 * is taken in once even if the companion is asked again before it forgets it.
 */
export const bridgeReceiptsTable = pgTable(
  "bridge_receipts",
  {
    id: id(),
    tenantId: tenantId(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => publishTargetsTable.id, { onDelete: "cascade" }),
    /** The companion's own id for the item: unique per target. */
    itemId: text("item_id").notNull(),
    kind: text("kind", { enum: ["submission", "order"] }).notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("bridge_receipts_item_unique").on(table.targetId, table.itemId)],
);

export type PublishTargetRow = typeof publishTargetsTable.$inferSelect;
export type NewPublishTargetRow = typeof publishTargetsTable.$inferInsert;
export type PublishRunRow = typeof publishRunsTable.$inferSelect;
