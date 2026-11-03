import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { SignedIn } from "../auth/auth.schema.js";
import type { PersonalDataHookContext, PersonLookup } from "./personal-data-declaration.js";
import { buildPersonalDataArchive, type ExportedKind } from "./personal-data-archive.js";
import {
  isSourceInUse,
  listPersonalDataSources,
  type PersonalDataSource,
  type PrivacyContext,
} from "./personal-data-sources.js";
import { insertPrivacyRequest, listPrivacyRequests } from "./privacy.repository.js";
import type {
  ErasureResponse,
  FoundKind,
  PersonSearchResponse,
  PrivacyRequestResponse,
} from "./privacy.schema.js";
import type { PrivacyRequestPart, PrivacyRequestRow } from "./privacy.table.js";
import { PersonalDataSourceError } from "./privacy.errors.js";

/**
 * Answering one person's request: finding everything the site holds about them, giving it to
 * them (right of access and portability) and erasing it (right to erasure). Every export and
 * erasure is recorded, saying who on the team did it and when, but nothing about the person.
 */

/**
 * The sources to look in: every searchable one whose feature is on, and those whose feature
 * is off but still has data (switching a plugin off deletes nothing), so nothing is missed.
 */
function searchableSources(context: PrivacyContext) {
  return listPersonalDataSources(context).filter(
    (source): source is PersonalDataSource & { hooks: NonNullable<PersonalDataSource["hooks"]> } =>
      source.hooks !== null,
  );
}

function hookContext(context: PrivacyContext, person: PersonLookup): PersonalDataHookContext {
  return { database: context.database, tenantId: DEFAULT_TENANT_ID, person };
}

/** Runs one source's hook, naming the source when it fails so the owner knows where to look. */
async function fromSource<Result>(source: PersonalDataSource, run: () => Promise<Result>) {
  try {
    return await run();
  } catch (error) {
    throw new PersonalDataSourceError(source.name, error);
  }
}

export async function findPerson(
  context: PrivacyContext,
  person: PersonLookup,
): Promise<PersonSearchResponse> {
  const found: FoundKind[] = [];
  for (const source of searchableSources(context)) {
    const items = await fromSource(source, () => source.hooks.find(hookContext(context, person)));
    if (items.length === 0) continue;
    found.push({ kindId: source.id, name: source.name, erasure: source.erasure, items });
  }
  const notSearched = listPersonalDataSources(context)
    .filter((source) => source.hooks === null && source.from !== "core")
    .filter((source) => isSourceInUse(source, context.enabledPlugins))
    .map((source) => ({
      kindId: source.id,
      name: source.name,
      reason: source.notSearchableReason ?? "",
    }));
  return { found, notSearched };
}

/** Everything held about the person, as a .zip, and a record that it was exported. */
export async function exportPerson(
  context: PrivacyContext,
  person: PersonLookup,
  signedIn: SignedIn,
  now = new Date(),
): Promise<{ archive: Buffer; filename: string }> {
  const kinds: ExportedKind[] = [];
  for (const source of searchableSources(context)) {
    const rows = await fromSource(source, () => source.hooks.export(hookContext(context, person)));
    if (rows.length > 0) kinds.push({ kindId: source.id, name: source.name, rows });
  }
  await recordRequest(
    context,
    "export",
    signedIn,
    kinds.map((kind) => ({
      source: kind.name,
      found: kind.rows.length,
      deleted: 0,
      anonymised: 0,
      kept: 0,
    })),
  );
  return {
    archive: await buildPersonalDataArchive(kinds, now),
    filename: `personal-data-${now.toISOString().slice(0, 10)}.zip`,
  };
}

/** Erases the person from every searchable source, by each source's own rule. */
export async function erasePerson(
  context: PrivacyContext,
  person: PersonLookup,
  signedIn: SignedIn,
): Promise<ErasureResponse> {
  const parts: PrivacyRequestPart[] = [];
  for (const source of searchableSources(context)) {
    const hookInput = hookContext(context, person);
    const found = await fromSource(source, () => source.hooks.find(hookInput));
    if (found.length === 0) continue;
    const outcome = await fromSource(source, () => source.hooks.erase(hookInput));
    parts.push({
      source: source.name,
      found: found.length,
      deleted: outcome.deleted,
      anonymised: outcome.anonymised ?? 0,
      kept: outcome.kept ?? 0,
    });
  }
  await recordRequest(context, "erase", signedIn, parts);
  return { parts };
}

async function recordRequest(
  context: PrivacyContext,
  kind: "export" | "erase",
  signedIn: SignedIn,
  parts: PrivacyRequestPart[],
) {
  await insertPrivacyRequest(context.database, {
    tenantId: DEFAULT_TENANT_ID,
    kind,
    actorId: signedIn.user.id,
    actorName: signedIn.user.name,
    parts,
  });
}

export async function listRecentRequests(
  context: Pick<PrivacyContext, "database">,
): Promise<PrivacyRequestResponse[]> {
  const rows = await listPrivacyRequests(context.database, DEFAULT_TENANT_ID, 20);
  return rows.map(toRequestResponse);
}

function toRequestResponse(row: PrivacyRequestRow): PrivacyRequestResponse {
  return {
    id: row.id,
    kind: row.kind,
    actorName: row.actorName,
    parts: row.parts,
    createdAt: row.createdAt.toISOString(),
  };
}
