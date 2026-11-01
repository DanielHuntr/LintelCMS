import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { isUniqueViolation } from "../database/database-errors.js";
import { parseRedirectCsv } from "./redirect-csv.js";
import {
  deleteRedirectRow,
  findRedirectFrom,
  findRedirectRow,
  insertRedirect,
  listRedirectRows,
  retargetRedirects,
  updateRedirectRow,
} from "./redirects.repository.js";
import {
  type CreateRedirectRequest,
  createRedirectRequestSchema,
  type DeliveredRedirectList,
  type RedirectImportResult,
  type RedirectResponse,
  type RedirectStatus,
  type UpdateRedirectRequest,
} from "./redirects.schema.js";
import {
  RedirectAddressTakenError,
  RedirectNotFoundError,
  RedirectToItselfError,
} from "./seo.errors.js";
import type { RedirectRow } from "./seo.table.js";

/** The redirects manager: adding, changing, importing and accepting suggested redirects. */

const FROM_INDEX = "redirects_tenant_from_unique";

export async function listRedirects(
  database: DatabaseOrTransaction,
  status?: RedirectStatus,
): Promise<{ redirects: RedirectResponse[] }> {
  const rows = await listRedirectRows(database, DEFAULT_TENANT_ID, status);
  return { redirects: rows.map(describeRedirect) };
}

/** What websites need: the active redirects, without the admin's bookkeeping. */
export async function listDeliveredRedirects(
  database: DatabaseOrTransaction,
): Promise<DeliveredRedirectList> {
  const rows = await listRedirectRows(database, DEFAULT_TENANT_ID, "active");
  return {
    redirects: rows.map((row) => ({
      from: row.fromPath,
      to: row.toPath,
      statusCode: row.statusCode,
    })),
  };
}

export async function createRedirect(
  database: DatabaseOrTransaction,
  request: CreateRedirectRequest,
): Promise<RedirectResponse> {
  if (request.fromPath === request.toPath) {
    throw new RedirectToItselfError();
  }
  if (await findRedirectFrom(database, DEFAULT_TENANT_ID, request.fromPath)) {
    throw new RedirectAddressTakenError(request.fromPath);
  }
  const row = await withFriendlyConflict(request.fromPath, () =>
    insertRedirect(database, { tenantId: DEFAULT_TENANT_ID, ...request, source: "manual" }),
  );
  return describeRedirect(row);
}

/** Changes a redirect. `status: "active"` accepts a suggestion and shortens any chain to it. */
export async function updateRedirect(
  database: DatabaseOrTransaction,
  redirectId: string,
  request: UpdateRedirectRequest,
): Promise<RedirectResponse> {
  const existing = await findRedirectOrFail(database, redirectId);
  const fromPath = request.fromPath ?? existing.fromPath;
  const toPath = request.toPath ?? existing.toPath;
  if (fromPath === toPath) {
    throw new RedirectToItselfError();
  }
  if (fromPath !== existing.fromPath) {
    const taken = await findRedirectFrom(database, DEFAULT_TENANT_ID, fromPath);
    if (taken) {
      throw new RedirectAddressTakenError(fromPath);
    }
  }

  await withFriendlyConflict(fromPath, () =>
    database.transaction(async (transaction) => {
      await updateRedirectRow(transaction, DEFAULT_TENANT_ID, redirectId, {
        fromPath,
        toPath,
        ...(request.statusCode !== undefined && { statusCode: request.statusCode }),
        ...(request.status !== undefined && { status: request.status }),
      });
      if (request.status === "active" && existing.status === "suggested") {
        await retargetRedirects(transaction, DEFAULT_TENANT_ID, fromPath, toPath, redirectId);
      }
    }),
  );
  return describeRedirect(await findRedirectOrFail(database, redirectId));
}

/** Deletes a redirect, or dismisses a suggestion. */
export async function deleteRedirect(
  database: DatabaseOrTransaction,
  redirectId: string,
): Promise<void> {
  if (!(await deleteRedirectRow(database, DEFAULT_TENANT_ID, redirectId))) {
    throw new RedirectNotFoundError();
  }
}

/**
 * Adds every usable line of a CSV. A line for an address that already has a redirect
 * replaces it, so importing the same file twice changes nothing. Lines that can't be used
 * are listed with the reason and skipped; the rest still go in.
 */
export async function importRedirects(
  database: DatabaseOrTransaction,
  csv: string,
): Promise<RedirectImportResult> {
  const result: RedirectImportResult = { added: 0, updated: 0, problems: [] };
  for (const line of parseRedirectCsv(csv)) {
    const parsed = createRedirectRequestSchema.safeParse({
      fromPath: line.from,
      toPath: line.to,
      statusCode: line.statusCode === undefined ? undefined : Number(line.statusCode),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "This line isn't a redirect";
      result.problems.push({ line: line.line, message });
      continue;
    }
    const redirect = parsed.data;
    if (redirect.fromPath === redirect.toPath) {
      result.problems.push({ line: line.line, message: "The old and new addresses are the same" });
      continue;
    }
    const existing = await findRedirectFrom(database, DEFAULT_TENANT_ID, redirect.fromPath);
    if (existing) {
      await updateRedirectRow(database, DEFAULT_TENANT_ID, existing.id, {
        toPath: redirect.toPath,
        statusCode: redirect.statusCode,
        status: "active",
        source: "import",
      });
      result.updated += 1;
    } else {
      await insertRedirect(database, {
        tenantId: DEFAULT_TENANT_ID,
        ...redirect,
        source: "import",
      });
      result.added += 1;
    }
  }
  return result;
}

async function findRedirectOrFail(
  database: DatabaseOrTransaction,
  redirectId: string,
): Promise<RedirectRow> {
  const row = await findRedirectRow(database, DEFAULT_TENANT_ID, redirectId);
  if (!row) {
    throw new RedirectNotFoundError();
  }
  return row;
}

async function withFriendlyConflict<Result>(
  fromPath: string,
  write: () => Promise<Result>,
): Promise<Result> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error, FROM_INDEX)) {
      throw new RedirectAddressTakenError(fromPath);
    }
    throw error;
  }
}

export function describeRedirect(row: RedirectRow): RedirectResponse {
  return {
    id: row.id,
    fromPath: row.fromPath,
    toPath: row.toPath,
    statusCode: row.statusCode,
    status: row.status,
    source: row.source,
    entryId: row.entryId,
    updatedAt: row.updatedAt.toISOString(),
  };
}
