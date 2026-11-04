import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { SignedIn } from "../auth/auth.schema.js";
import type { PersonalDataHookContext, PersonLookup } from "./personal-data-declaration.js";
import { buildPersonalDataArchive, type ExportedKind } from "./personal-data-archive.js";
import {
  listPersonalDataSources,
  type PersonalDataSource,
  type PrivacyContext,
} from "./personal-data-sources.js";
import { insertPrivacyRequest, listPrivacyRequests } from "./privacy.repository.js";
import type {
  ErasureResponse,
  FoundKind,
  PersonActionRequest,
  PersonSearchResponse,
  PrivacyRequestResponse,
} from "./privacy.schema.js";
import type { PrivacyRequestPart, PrivacyRequestRow } from "./privacy.table.js";
import { CantChooseRecordsError, PersonalDataSourceError } from "./privacy.errors.js";

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

function hookContext(
  context: PrivacyContext,
  person: PersonLookup,
  only?: ReadonlySet<string>,
): PersonalDataHookContext {
  return {
    database: context.database,
    tenantId: DEFAULT_TENANT_ID,
    person,
    ...(only && { only }),
  };
}

type SearchableSource = ReturnType<typeof searchableSources>[number];

/**
 * Each source to work on, with what to give its hooks, worked out for all of them first so a
 * refusal comes before anything is done. With records ticked, a source none of them belong
 * to is left alone, and one that can't pick out records is only used if all of it was ticked.
 */
async function planWork(
  context: PrivacyContext,
  { selected, ...person }: PersonActionRequest,
): Promise<Array<{ source: SearchableSource; input: PersonalDataHookContext }>> {
  const work = [];
  for (const source of searchableSources(context)) {
    if (!selected) {
      work.push({ source, input: hookContext(context, person) });
      continue;
    }
    const ticked = new Set(
      selected.filter((record) => record.kindId === source.id).map((record) => record.id),
    );
    if (ticked.size === 0) continue;
    if (source.hooks.choosesRecords) {
      work.push({ source, input: hookContext(context, person, ticked) });
      continue;
    }
    const input = hookContext(context, person);
    const found = await fromSource(source, () => source.hooks.find(input));
    if (found.some((item) => !ticked.has(item.id))) throw new CantChooseRecordsError(source.name);
    work.push({ source, input });
  }
  return work;
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
    found.push({
      kindId: source.id,
      name: source.name,
      erasure: source.erasure,
      items: items.map((item) => ({ ...item, email: item.email ?? null })),
    });
  }
  const notSearched = listPersonalDataSources(context)
    // Switched off or not, its data is still there.
    .filter((source) => source.hooks === null && source.from !== "core")
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
  person: PersonActionRequest,
  signedIn: SignedIn,
  now = new Date(),
): Promise<{ archive: Buffer; filename: string }> {
  const kinds: ExportedKind[] = [];
  for (const { source, input } of await planWork(context, person)) {
    const rows = await fromSource(source, () => source.hooks.export(input));
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
  person: PersonActionRequest,
  signedIn: SignedIn,
): Promise<ErasureResponse> {
  const parts: PrivacyRequestPart[] = [];
  const explanations: string[] = [];
  const work = await planWork(context, person);
  try {
    for (const { source, input: hookInput } of work) {
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
      if (outcome.explanation) explanations.push(outcome.explanation);
    }
  } finally {
    // Also when one kind failed part way: what was erased before it is still a thing done.
    await recordRequest(context, "erase", signedIn, parts);
  }
  return { parts, explanations };
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
