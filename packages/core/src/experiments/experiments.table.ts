import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";
import type {
  ExperimentGoal,
  ExperimentScope,
  ExperimentStatus,
  VersionKey,
} from "./experiments.schema.js";

/**
 * An A/B test of one page: which versions it shows, what counts as success, how visitors are
 * split and whether it is running. `secret` is mixed into each visitor's version choice, so
 * a version can't be predicted or chosen from outside, and each test splits visitors afresh.
 * See docs/decisions/0044-ab-testing.md.
 */
export const experimentsTable = pgTable(
  "experiments",
  {
    id: id(),
    tenantId: tenantId(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    scope: text("scope").$type<ExperimentScope>().notNull(),
    /** For a section test: the id of the section, the same in every version. */
    sectionId: text("section_id"),
    status: text("status").$type<ExperimentStatus>().notNull().default("draft"),
    goal: jsonb("goal").$type<ExperimentGoal>(),
    /** Whole percent per version, original first: [50, 50]. */
    split: jsonb("split").$type<number[]>().notNull(),
    secret: text("secret").notNull(),
    winner: text("winner").$type<VersionKey>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("experiments_tenant_entry_idx").on(table.tenantId, table.entryId),
    index("experiments_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

/**
 * Version B or C of a tested page. `design` is a page design (see @lintel/builder-model): the
 * whole page, or for a section test just that section's element.
 */
export const experimentVersionsTable = pgTable(
  "experiment_versions",
  {
    id: id(),
    tenantId: tenantId(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experimentsTable.id, { onDelete: "cascade" }),
    key: text("key").$type<VersionKey>().notNull(),
    design: jsonb("design").$type<Record<string, unknown>>().notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("experiment_versions_key_idx").on(table.experimentId, table.key)],
);

/**
 * How many browsers saw each version, and how many of those reached the goal, per day. Only
 * counts: nothing here says who a visitor was.
 */
export const experimentCountsTable = pgTable(
  "experiment_counts",
  {
    tenantId: tenantId(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experimentsTable.id, { onDelete: "cascade" }),
    versionKey: text("version_key").$type<VersionKey>().notNull(),
    day: date("day", { mode: "string" }).notNull(),
    visitors: integer("visitors").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.experimentId, table.versionKey, table.day] })],
);

export type ExperimentRow = typeof experimentsTable.$inferSelect;
export type NewExperimentRow = typeof experimentsTable.$inferInsert;
export type ExperimentVersionRow = typeof experimentVersionsTable.$inferSelect;
