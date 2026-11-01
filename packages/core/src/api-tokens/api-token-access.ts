import { hasPermission, type Permission } from "../roles/permissions.js";
import type { ApiTokenAccess } from "./api-tokens.schema.js";

/**
 * What each kind of token may do. A token never gets settings, users or roles: those stay
 * with people signed in to the admin.
 *
 * A read token sees what is published, plus the content model and the media library. It
 * can't read drafts: read tokens end up in websites' code, sometimes in browsers, and a
 * leaked one shouldn't show unpublished work. Drafts need a read-write token.
 */
const readPermissions: Permission[] = ["blueprints:read", "collections:read", "media:read"];

const writePermissions: Permission[] = [
  "entries:read",
  "entries:create",
  "entries:update",
  "entries:publish",
  "entries:delete",
  "media:upload",
  "media:update",
  "media:delete",
];

/**
 * The token's permissions, limited to what the admin who made it may do, so a token can
 * never be used to get round someone's role.
 */
export function permissionsForApiToken(
  access: ApiTokenAccess,
  creatorPermissions: readonly string[],
): string[] {
  const wanted =
    access === "readWrite" ? [...readPermissions, ...writePermissions] : readPermissions;
  return wanted.filter((permission) => hasPermission(creatorPermissions, permission));
}
