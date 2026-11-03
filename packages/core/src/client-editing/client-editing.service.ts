import { findDesignChanges, sameValue, validatePageDocument } from "@lintel/builder-model";
import type { BlockCheckLibrary } from "../fieldtypes/fieldtype.js";
import type { SignedIn } from "../auth/auth.schema.js";
import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import type { EntryData } from "../entries/entries.table.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { TEMPLATE_CHOICE_KEY } from "../liquid-templates/template-choice.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { hasPermission } from "../roles/permissions.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import {
  AlreadyWaitingForReviewError,
  DesignChangeNotAllowedError,
  ReviewNeededError,
  ReviewNotNeededError,
} from "./client-editing.errors.js";
import type {
  ClientEditingSettings,
  ClientReviewResponse,
  EntryReviewState,
} from "./client-editing.schema.js";
import {
  type ClientReviewWithNames,
  findLatestReviewForEntry,
  insertClientReview,
} from "./client-reviews.repository.js";

/**
 * Content-only editing: people without `builder:design` (the "Client (content only)" role)
 * change only the content a designer opened up, and, while the site's "Clients' changes"
 * setting is "Wait for approval", send their changes for review instead of publishing.
 * Reviews are answered in client-reviews.service.ts.
 */

/** Whether someone may change content but not the design. */
export function isContentOnly(permissions: readonly string[]): boolean {
  return !hasPermission(permissions, "builder:design");
}

export async function readClientEditingSettings(
  database: DatabaseOrTransaction,
): Promise<ClientEditingSettings> {
  return { clientChanges: await readSetting(database, "clientChanges") };
}

export async function updateClientEditingSettings(
  database: DatabaseOrTransaction,
  settings: ClientEditingSettings,
): Promise<ClientEditingSettings> {
  await writeSetting(database, "clientChanges", settings.clientChanges);
  return readClientEditingSettings(database);
}

/** Whether this person's changes wait for approval rather than go live when they publish. */
export async function mustSendForReview(
  database: DatabaseOrTransaction,
  permissions: readonly string[],
): Promise<boolean> {
  return (
    isContentOnly(permissions) && (await readSetting(database, "clientChanges")) === "needsApproval"
  );
}

/**
 * The `entry.publishing` check, and the same rule for taking pages off the site: a client
 * whose changes wait for approval sends them for review instead.
 */
export async function refuseWhenReviewNeeded(
  database: DatabaseOrTransaction,
  permissions: readonly string[],
): Promise<void> {
  if (await mustSendForReview(database, permissions)) throw new ReviewNeededError();
}

/**
 * A save from someone without `builder:design`: each page design may change only where its
 * designer allows clients to (see client-editing/ in @lintel/builder-model), and the page's
 * template stays as it is. Called with the checked values, before they are stored.
 */
export function checkContentOnlyChange(
  fields: readonly FieldDefinition[],
  previousData: Readonly<EntryData>,
  data: Readonly<EntryData>,
  permissions: readonly string[] | undefined,
  /** The site's components, for whether clients may choose their variants. */
  components?: BlockCheckLibrary,
): void {
  if (!permissions || !isContentOnly(permissions)) return;
  const rules = {
    mayChooseVariant: (component: string) =>
      components?.find(component)?.variants?.clientsMayChoose === true,
  };
  for (const field of fields) {
    if (field.type !== "page") continue;
    const before = previousData[field.handle] ?? null;
    const after = data[field.handle] ?? null;
    if (sameValue(before, after)) continue;
    const previous = before === null ? null : validatePageDocument(before, pageComponentCatalogue);
    const next = after === null ? null : validatePageDocument(after, pageComponentCatalogue);
    if (next === null || (next.ok && previous?.ok === false)) {
      throw new DesignChangeNotAllowedError(field.label);
    }
    if (!next.ok) continue; // The field's own check reports it.
    const changes = findDesignChanges(
      previous?.ok ? previous.document : null,
      next.document,
      pageComponentCatalogue,
      rules,
    );
    const first = changes[0];
    if (first) throw new DesignChangeNotAllowedError(first.where);
  }
  if (!sameValue(previousData[TEMPLATE_CHOICE_KEY], data[TEMPLATE_CHOICE_KEY])) {
    throw new DesignChangeNotAllowedError("Template");
  }
}

/** Where the entry's review stands, for the person asking. */
export async function findEntryReviewState(
  database: DatabaseOrTransaction,
  entryId: string,
  permissions: readonly string[],
): Promise<EntryReviewState> {
  await findEntryOrFail(database, entryId);
  const needsApproval = (await readSetting(database, "clientChanges")) === "needsApproval";
  const review = await findLatestReviewForEntry(database, entryId);
  return {
    needsApproval,
    mustSendForReview: needsApproval && isContentOnly(permissions),
    review: review ? describeReview(review) : null,
  };
}

/** "Send for review": the entry's saved values wait for someone who may publish them. */
export async function sendForReview(
  database: DatabaseOrTransaction,
  entryId: string,
  note: string,
  signedIn: Pick<SignedIn, "user" | "permissions">,
): Promise<EntryReviewState> {
  const entry = await findEntryOrFail(database, entryId);
  if ((await readSetting(database, "clientChanges")) !== "needsApproval") {
    throw new ReviewNotNeededError();
  }
  const latest = await findLatestReviewForEntry(database, entry.id);
  if (latest?.status === "waiting") throw new AlreadyWaitingForReviewError();
  await insertClientReview(database, {
    entryId: entry.id,
    requestedBy: signedIn.user.id,
    requestNote: note,
  });
  return findEntryReviewState(database, entry.id, signedIn.permissions);
}

export function describeReview(review: ClientReviewWithNames): ClientReviewResponse {
  return {
    id: review.id,
    entryId: review.entryId,
    status: review.status,
    requestedByName: review.requestedByName,
    requestNote: review.requestNote,
    requestedAt: review.createdAt.toISOString(),
    decidedByName: review.decidedByName,
    decisionNote: review.decisionNote,
    decidedAt: review.decidedAt?.toISOString() ?? null,
  };
}

/** The entry's title and collection, for the review list. */
export async function describeReviewedEntry(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<{ id: string; title: string; collection: string; collectionName: string }> {
  const entry = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const title = entry.data.title;
  return {
    id: entry.id,
    title: typeof title === "string" ? title : "",
    collection: collection.handle,
    collectionName: collection.name,
  };
}
