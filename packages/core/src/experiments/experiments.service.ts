import { randomBytes } from "node:crypto";
import { applyScriptRule, findChangedCode, type PageDocument } from "@lintel/builder-model";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import { removeScriptsFromCodeHtml } from "../fieldtypes/code-html-cleaner.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { hasPermission } from "../roles/permissions.js";
import { readSetting } from "../settings/settings.service.js";
import { findTopSection, readDesign, sectionOnly } from "./experiment-designs.js";
import {
  ExperimentEndedError,
  ExperimentNotFoundError,
  ExperimentNotReadyError,
  ExperimentRunningError,
  InvalidVersionDesignError,
  NothingToTestError,
  PageHasOpenExperimentError,
  SectionNotFoundError,
  SplitDoesNotMatchError,
  TooManyVersionsError,
  VersionNotFoundError,
  VersionChangedError,
} from "./experiments.errors.js";
import {
  deleteExperimentRow,
  deleteVersionRow,
  type ExperimentWithPage,
  findExperimentRow,
  findOpenExperimentRowForEntry,
  insertExperimentRow,
  listExperimentRows,
  listVersionRows,
  saveVersionRow,
  updateExperimentRow,
} from "./experiments.repository.js";
import {
  type ChallengerKey,
  challengerKeys,
  type ExperimentGoal,
  type ExperimentResponse,
  MAXIMUM_VERSIONS,
  type VersionKey,
} from "./experiments.schema.js";
import type { ExperimentVersionRow } from "./experiments.table.js";

/**
 * A/B tests of pages: trying another version of a page (or of one of its sections), choosing
 * what counts as success, starting and pausing. Results and ending a test are in
 * experiment-results.service.ts. Every page has at most one test that hasn't ended.
 */

const tenantId = DEFAULT_TENANT_ID;

/** The field of a page that holds its design, and that the website draws. */
export const DESIGN_FIELD = "design";

export async function listExperiments(database: DatabaseOrTransaction) {
  const rows = await listExperimentRows(database, tenantId);
  const versions = await listVersionRows(
    database,
    tenantId,
    rows.map(({ experiment }) => experiment.id),
  );
  return { experiments: rows.map((row) => toResponse(row, versions)) };
}

export async function findExperiment(
  database: DatabaseOrTransaction,
  experimentId: string,
): Promise<ExperimentResponse> {
  const row = await findExperimentRowOrFail(database, experimentId);
  return toResponse(row, await listVersionRows(database, tenantId, [experimentId]));
}

/** The page's open test, or null: what the page designer shows its versions from. */
export async function findOpenExperimentForEntry(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<ExperimentResponse | null> {
  const row = await findOpenExperimentRowForEntry(database, tenantId, entryId);
  if (!row) return null;
  return toResponse(row, await listVersionRows(database, tenantId, [row.experiment.id]));
}

/** "Try another version": a test of the page (or one section), with Version B a copy of it. */
export async function createExperiment(
  database: DatabaseOrTransaction,
  request: { entryId: string; sectionId?: string },
): Promise<ExperimentResponse> {
  if (await findOpenExperimentRowForEntry(database, tenantId, request.entryId)) {
    throw new PageHasOpenExperimentError();
  }
  const page = await readPageDesign(database, request.entryId);
  let firstVersion = page;
  if (request.sectionId) {
    const section = findTopSection(page, request.sectionId);
    if (!section) throw new SectionNotFoundError();
    firstVersion = sectionOnly(page, section);
  }
  const created = await insertExperimentRow(database, {
    tenantId,
    entryId: request.entryId,
    scope: request.sectionId ? "section" : "page",
    sectionId: request.sectionId ?? null,
    split: evenSplit(2),
    secret: randomBytes(32).toString("hex"),
  });
  await saveVersionRow(database, {
    tenantId,
    experimentId: created.id,
    key: "b",
    design: firstVersion as unknown as Record<string, unknown>,
  });
  return findExperiment(database, created.id);
}

/** Another version (C), a copy of the original or of B. Shares go back to even. */
export async function addVersion(
  database: DatabaseOrTransaction,
  experimentId: string,
  from: VersionKey,
): Promise<ExperimentResponse> {
  const row = await findChangeableExperiment(database, experimentId, "add a version");
  const versions = await listVersionRows(database, tenantId, [experimentId]);
  const key = challengerKeys.find(
    (candidate) => !versions.some((version) => version.key === candidate),
  );
  if (!key || versions.length + 1 >= MAXIMUM_VERSIONS) throw new TooManyVersionsError();
  let design: PageDocument;
  if (from === "original") {
    const page = await readPageDesign(database, row.experiment.entryId);
    design = sectionScopedCopy(row, page);
  } else {
    const source = versions.find((version) => version.key === from);
    if (!source) throw new VersionNotFoundError(from);
    design = source.design as unknown as PageDocument;
  }
  await saveVersionRow(database, {
    tenantId,
    experimentId,
    key,
    design: design as unknown as Record<string, unknown>,
  });
  await updateExperimentRow(database, tenantId, experimentId, {
    split: evenSplit(versions.length + 2),
  });
  return findExperiment(database, experimentId);
}

/**
 * Saves a version's design, by the same rules as saving a page: it must be a valid design,
 * code needs `builder:code`, and the site's script rule is applied. A section version may be
 * sent as the whole page; only its section is kept.
 */
export async function saveVersion(
  database: DatabaseOrTransaction,
  experimentId: string,
  key: ChallengerKey,
  design: unknown,
  permissions: readonly string[],
  /** When the version was saved, as the person saving last read it. */
  baseUpdatedAt?: string | null,
): Promise<ExperimentResponse> {
  const row = await findChangeableExperiment(database, experimentId, "change a version", true);
  const versions = await listVersionRows(database, tenantId, [experimentId]);
  const existing = versions.find((version) => version.key === key);
  if (!existing) throw new VersionNotFoundError(key);
  if (baseUpdatedAt !== undefined && baseUpdatedAt !== existing.updatedAt.toISOString()) {
    throw new VersionChangedError(existing.updatedAt.toISOString());
  }
  const checked = readDesign(design);
  if (!checked) throw new InvalidVersionDesignError("That design couldn't be read. Try again.");
  let page = checked;
  if (row.experiment.scope === "section" && row.experiment.sectionId) {
    const section = findTopSection(checked, row.experiment.sectionId);
    if (!section) {
      throw new InvalidVersionDesignError(
        "This version has to keep the section it tries. Undo the change, or end the test.",
      );
    }
    page = sectionOnly(checked, section);
  }
  page = applyScriptRule(
    page,
    await readSetting(database, "builderCustomScripts"),
    removeScriptsFromCodeHtml,
  );
  if (!hasPermission(permissions, "builder:code")) {
    const previous = readDesign(existing.design);
    if (findChangedCode(previous, page, pageComponentCatalogue).length > 0) {
      throw new InvalidVersionDesignError(
        "Only people allowed to edit code can add or change code. Ask a developer, or undo the change.",
      );
    }
  }
  await saveVersionRow(database, {
    tenantId,
    experimentId,
    key,
    design: page as unknown as Record<string, unknown>,
  });
  return findExperiment(database, experimentId);
}

/**
 * Takes a version out of a test that isn't running. C becomes B when B goes. A test that never
 * ran goes with its last version; one that ran has to be ended instead, to keep its results.
 */
export async function removeVersion(
  database: DatabaseOrTransaction,
  experimentId: string,
  key: ChallengerKey,
): Promise<ExperimentResponse | null> {
  const row = await findChangeableExperiment(database, experimentId, "remove a version");
  const versions = await listVersionRows(database, tenantId, [experimentId]);
  if (!versions.some((version) => version.key === key)) throw new VersionNotFoundError(key);
  const remaining = versions.filter((version) => version.key !== key);
  if (remaining.length === 0) {
    if (row.experiment.startedAt) throw new ExperimentNotReadyError("version");
    await deleteExperimentRow(database, tenantId, experimentId);
    return null;
  }
  await database.transaction(async (transaction) => {
    await deleteVersionRow(transaction, tenantId, experimentId, key);
    for (const [index, version] of remaining.entries()) {
      const newKey = challengerKeys[index];
      if (newKey && newKey !== version.key) {
        await deleteVersionRow(transaction, tenantId, experimentId, version.key);
        await saveVersionRow(transaction, {
          tenantId,
          experimentId,
          key: newKey,
          design: version.design,
        });
      }
    }
    await updateExperimentRow(transaction, tenantId, experimentId, {
      split: evenSplit(remaining.length + 1),
    });
  });
  return findExperiment(database, experimentId);
}

/** The goal and the split, while the test isn't running. */
export async function updateExperiment(
  database: DatabaseOrTransaction,
  experimentId: string,
  changes: { goal?: ExperimentGoal | null; split?: number[] },
): Promise<ExperimentResponse> {
  await findChangeableExperiment(database, experimentId, "change it");
  const versions = await listVersionRows(database, tenantId, [experimentId]);
  if (changes.split && changes.split.length !== versions.length + 1) {
    throw new SplitDoesNotMatchError(versions.length + 1);
  }
  await updateExperimentRow(database, tenantId, experimentId, {
    ...(changes.goal !== undefined ? { goal: changes.goal } : {}),
    ...(changes.split ? { split: changes.split } : {}),
  });
  return findExperiment(database, experimentId);
}

export async function startExperiment(
  database: DatabaseOrTransaction,
  experimentId: string,
  now = new Date(),
): Promise<ExperimentResponse> {
  const row = await findExperimentRowOrFail(database, experimentId);
  if (row.experiment.status === "ended") throw new ExperimentEndedError();
  if (row.experiment.status === "running") return findExperiment(database, experimentId);
  if (!row.experiment.goal) throw new ExperimentNotReadyError("goal");
  const versions = await listVersionRows(database, tenantId, [experimentId]);
  if (versions.length === 0) throw new ExperimentNotReadyError("version");
  await updateExperimentRow(database, tenantId, experimentId, {
    status: "running",
    startedAt: row.experiment.startedAt ?? now,
  });
  return findExperiment(database, experimentId);
}

/** Pauses the test: everyone sees the original until it is started again. */
export async function stopExperiment(
  database: DatabaseOrTransaction,
  experimentId: string,
): Promise<ExperimentResponse> {
  const row = await findExperimentRowOrFail(database, experimentId);
  if (row.experiment.status === "ended") throw new ExperimentEndedError();
  if (row.experiment.status === "running") {
    await updateExperimentRow(database, tenantId, experimentId, { status: "stopped" });
  }
  return findExperiment(database, experimentId);
}

export async function deleteExperiment(
  database: DatabaseOrTransaction,
  experimentId: string,
): Promise<void> {
  await findExperimentRowOrFail(database, experimentId);
  await deleteExperimentRow(database, tenantId, experimentId);
}

export async function findExperimentRowOrFail(
  database: DatabaseOrTransaction,
  experimentId: string,
): Promise<ExperimentWithPage> {
  const row = await findExperimentRow(database, tenantId, experimentId);
  if (!row) throw new ExperimentNotFoundError();
  return row;
}

/**
 * A test that may be changed: not ended, and not running unless `whileRunning` (versions can
 * be touched up while a test runs; adding or removing one, or changing the goal, can't).
 */
async function findChangeableExperiment(
  database: DatabaseOrTransaction,
  experimentId: string,
  action: string,
  whileRunning = false,
): Promise<ExperimentWithPage> {
  const row = await findExperimentRowOrFail(database, experimentId);
  if (row.experiment.status === "ended") throw new ExperimentEndedError();
  if (row.experiment.status === "running" && !whileRunning)
    throw new ExperimentRunningError(action);
  return row;
}

/** The page's saved design (its working copy), which a new version starts as a copy of. */
export async function readPageDesign(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<PageDocument> {
  const entry = await findEntryOrFail(database, entryId);
  const design = readDesign(entry.data[DESIGN_FIELD]);
  if (!design || design.root.children.length === 0) throw new NothingToTestError();
  return design;
}

function sectionScopedCopy(row: ExperimentWithPage, page: PageDocument): PageDocument {
  const { scope, sectionId } = row.experiment;
  if (scope !== "section" || !sectionId) return page;
  const section = findTopSection(page, sectionId);
  if (!section) throw new SectionNotFoundError();
  return sectionOnly(page, section);
}

/** Shares as even as whole percent allow, the original getting any extra: [34, 33, 33]. */
export function evenSplit(versions: number): number[] {
  const share = Math.floor(100 / versions);
  return Array.from({ length: versions }, (_, index) =>
    index === 0 ? 100 - share * (versions - 1) : share,
  );
}

function toResponse(
  row: ExperimentWithPage,
  versions: readonly ExperimentVersionRow[],
): ExperimentResponse {
  const { experiment } = row;
  return {
    id: experiment.id,
    entryId: experiment.entryId,
    pageTitle: row.pageTitle,
    collection: row.collection,
    scope: experiment.scope,
    sectionId: experiment.sectionId,
    status: experiment.status,
    goal: experiment.goal,
    split: experiment.split,
    winner: experiment.winner,
    startedAt: experiment.startedAt?.toISOString() ?? null,
    endedAt: experiment.endedAt?.toISOString() ?? null,
    createdAt: experiment.createdAt.toISOString(),
    versions: versions
      .filter((version) => version.experimentId === experiment.id)
      .map((version) => ({
        key: version.key,
        design: version.design,
        updatedAt: version.updatedAt.toISOString(),
      })),
  };
}
