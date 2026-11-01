import type { FastifyReply, FastifyRequest } from "fastify";
import { PermissionDeniedError } from "../auth/auth.errors.js";
import { getSignedIn, requireSignedIn } from "../auth/require-permission.js";
import { hasPermission } from "../roles/permissions.js";
import { TwoFactorSetupRequiredError } from "../two-factor/two-factor.errors.js";
import { EntryNotFoundError } from "./entries.errors.js";
import { findEntryById } from "./entries.repository.js";
import { entryIdParamsSchema } from "./entries.schema.js";

/** Changes to an entry that a role can allow for everyone's entries, or only its own. */
export type EntryAction = "update" | "publish" | "delete";

/**
 * A guard for routes that change one entry (`/entries/:id/...`). It allows the change with
 * `entries:<action>`, or with `entries:<action>-own` when the signed-in person created the
 * entry. This is how Authors edit and publish their own posts and nobody else's.
 */
export function requireEntryPermission(action: EntryAction) {
  const permission = `entries:${action}` as const;
  const ownPermission = `entries:${action}-own` as const;

  return async function checkEntryPermission(request: FastifyRequest, reply: FastifyReply) {
    await requireSignedIn(request, reply);
    const signedIn = getSignedIn(request);
    if (signedIn.mustSetUpTwoFactor) {
      throw new TwoFactorSetupRequiredError();
    }
    if (hasPermission(signedIn.permissions, permission)) {
      return;
    }
    if (hasPermission(signedIn.permissions, ownPermission)) {
      const parsed = entryIdParamsSchema.safeParse({ id: (request.params as { id?: unknown }).id });
      if (!parsed.success) {
        throw new EntryNotFoundError();
      }
      const entry = await findEntryById(request.server.database, parsed.data.id);
      if (!entry) {
        throw new EntryNotFoundError();
      }
      if (entry.createdBy === signedIn.user.id) {
        return;
      }
    }
    throw new PermissionDeniedError(permission);
  };
}
