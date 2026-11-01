import type { SignedIn } from "../auth/auth.schema.js";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { findPermissionsForUser, findSiteIdsForUser } from "../roles/roles.service.js";
import { readSetting } from "../settings/settings.service.js";
import { findUserById } from "../users/users.repository.js";
import { permissionsForApiToken } from "./api-token-access.js";
import { generateApiTokenSecret, hashApiTokenSecret, visibleStartOf } from "./api-token-secrets.js";
import { ApiTokenNotFoundError } from "./api-tokens.errors.js";
import {
  type ApiTokenWithCreator,
  deleteApiTokenRow,
  findApiTokenByHash,
  insertApiToken,
  listApiTokenRows,
  recordApiTokenUse,
} from "./api-tokens.repository.js";
import type {
  ApiTokenAccess,
  ApiTokenResponse,
  CreateApiTokenRequest,
  CreatedApiToken,
} from "./api-tokens.schema.js";

/**
 * Making, listing and checking API tokens. The secret is returned once, by
 * `createApiToken`; after that only its hash exists.
 */

/** "Last used" is only written when it is this stale, so busy sites don't write on every request. */
const LAST_USED_ACCURACY_MILLISECONDS = 60_000;

export async function listApiTokens(
  database: DatabaseOrTransaction,
): Promise<{ tokens: ApiTokenResponse[] }> {
  const rows = await listApiTokenRows(database, DEFAULT_TENANT_ID);
  return { tokens: rows.map(describeApiToken) };
}

export async function createApiToken(
  database: DatabaseOrTransaction,
  request: CreateApiTokenRequest,
  createdBy: { id: string; name: string },
): Promise<CreatedApiToken> {
  const secret = generateApiTokenSecret();
  const row = await insertApiToken(database, {
    tenantId: DEFAULT_TENANT_ID,
    name: request.name,
    access: request.access,
    tokenHash: hashApiTokenSecret(secret),
    tokenStart: visibleStartOf(secret),
    createdBy: createdBy.id,
  });
  return { token: describeApiToken({ ...row, creatorName: createdBy.name }), secret };
}

export async function deleteApiToken(
  database: DatabaseOrTransaction,
  tokenId: string,
): Promise<{ id: string; name: string }> {
  const deleted = await deleteApiTokenRow(database, DEFAULT_TENANT_ID, tokenId);
  if (!deleted) {
    throw new ApiTokenNotFoundError();
  }
  return deleted;
}

export interface AuthenticatedApiToken {
  tokenId: string;
  access: ApiTokenAccess;
  /** The admin who made the token, with the token's permissions rather than their own. */
  signedIn: SignedIn;
}

/** Who a token acts for and what it may do, or undefined for an unknown token. */
export async function authenticateApiToken(
  database: Database,
  secret: string,
  now = new Date(),
): Promise<AuthenticatedApiToken | undefined> {
  const token = await findApiTokenByHash(database, hashApiTokenSecret(secret));
  if (!token) {
    return undefined;
  }
  const creator = await findUserById(database, token.createdBy);
  // A deactivated admin's tokens stop working with their account.
  if (!creator || creator.status !== "active") {
    return undefined;
  }

  const lastUsed = token.lastUsedAt?.getTime() ?? 0;
  if (now.getTime() - lastUsed > LAST_USED_ACCURACY_MILLISECONDS) {
    await recordApiTokenUse(database, token.id, now);
  }

  const creatorPermissions = await findPermissionsForUser(database, creator.id);
  return {
    tokenId: token.id,
    access: token.access,
    signedIn: {
      user: { id: creator.id, email: creator.email, name: creator.name },
      permissions: permissionsForApiToken(token.access, creatorPermissions),
      enabledPlugins: await findEnabledPluginIds(database),
      siteName: await readSetting(database, "siteName"),
      siteIds: await findSiteIdsForUser(database, creator.id),
    },
  };
}

function describeApiToken(row: ApiTokenWithCreator): ApiTokenResponse {
  return {
    id: row.id,
    name: row.name,
    access: row.access,
    tokenStart: row.tokenStart,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdBy: row.creatorName === null ? null : { id: row.createdBy, name: row.creatorName },
  };
}
