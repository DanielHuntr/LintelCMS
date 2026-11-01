import type { FastifyInstance } from "fastify";
import { type SignInResult, startSignedInSession } from "../auth/auth.service.js";
import { hashPassword } from "../auth/passwords.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { sendEmail } from "../email/email.js";
import { generateOneTimeTokenSecret } from "../one-time-tokens/one-time-tokens.service.js";
import { assignRoleToUser } from "../roles/roles.repository.js";
import { checkRoleCanBeGranted, findRoleOrFail } from "../roles/roles.service.js";
import { hashSessionToken } from "../sessions/sessions.service.js";
import type { Actor } from "../users/user-management.service.js";
import { EmailAlreadyUsedHttpError } from "../users/users.errors.js";
import { findUserByEmail, insertUser } from "../users/users.repository.js";
import { requireStrongPassword } from "../users/users.service.js";
import { InvitationLinkInvalidError, InvitationNotFoundError } from "./invitations.errors.js";
import {
  deleteInvitationRow,
  findInvitationRow,
  type InvitationWithNames,
  listInvitationRows,
  updateInvitationToken,
  upsertInvitation,
} from "./invitations.repository.js";
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  InvitationPreview,
  InvitationResponse,
} from "./invitations.schema.js";

/**
 * Inviting people by email. The invitation link opens the accept screen, where the new
 * person chooses their name and password; accepting creates their account with the role
 * they were invited with, and signs them in.
 */

export const INVITATION_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

export interface SentInvitation {
  invitation: InvitationResponse;
  /**
   * The link, shown once to whoever sent it, so they can pass it on themselves when email
   * isn't set up yet. Only its hash is kept.
   */
  invitationUrl: string;
}

export async function listInvitations(
  server: FastifyInstance,
  now = new Date(),
): Promise<InvitationResponse[]> {
  const rows = await listInvitationRows(server.database, DEFAULT_TENANT_ID);
  return rows.map((row) => describeInvitation(row, now));
}

export async function inviteSomeone(
  server: FastifyInstance,
  actor: Actor,
  request: CreateInvitationRequest,
  now = new Date(),
): Promise<SentInvitation> {
  const database = server.database;
  if (await findUserByEmail(database, DEFAULT_TENANT_ID, request.email)) {
    throw new EmailAlreadyUsedHttpError(request.email);
  }
  const role = await findRoleOrFail(database, request.roleId);
  checkRoleCanBeGranted(role, actor.permissions);

  const token = generateOneTimeTokenSecret();
  const saved = await upsertInvitation(database, {
    tenantId: DEFAULT_TENANT_ID,
    email: request.email,
    roleId: role.id,
    invitedBy: actor.user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MILLISECONDS),
    createdAt: now,
  });
  const row = await findInvitationOrFail(server, saved.id);
  return {
    invitation: describeInvitation(row, now),
    invitationUrl: emailInvitation(server, row, token),
  };
}

/** A new link and a new week to use it; the old link stops working. */
export async function resendInvitation(
  server: FastifyInstance,
  invitationId: string,
  now = new Date(),
): Promise<SentInvitation> {
  const row = await findInvitationOrFail(server, invitationId);
  const token = generateOneTimeTokenSecret();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MILLISECONDS);
  await updateInvitationToken(server.database, row.id, hashSessionToken(token), expiresAt);
  const updated = { ...row, expiresAt };
  return {
    invitation: describeInvitation(updated, now),
    invitationUrl: emailInvitation(server, updated, token),
  };
}

export async function revokeInvitation(
  server: FastifyInstance,
  invitationId: string,
): Promise<InvitationWithNames> {
  const row = await findInvitationOrFail(server, invitationId);
  await deleteInvitationRow(server.database, row.id);
  return row;
}

export async function previewInvitation(
  server: FastifyInstance,
  token: string,
  now = new Date(),
): Promise<InvitationPreview> {
  const row = await findUsableInvitation(server, token, now);
  return { email: row.email, roleName: row.roleName, invitedByName: row.inviterName };
}

export async function acceptInvitation(
  server: FastifyInstance,
  request: AcceptInvitationRequest,
  userAgent: string | undefined,
  now = new Date(),
): Promise<SignInResult & { invitation: InvitationWithNames }> {
  const preview = await findUsableInvitation(server, request.token, now);
  requireStrongPassword(request.password, request.name, preview.email);
  const passwordHash = await hashPassword(request.password);
  const { user, invitation } = await server.database.transaction(async (transaction) => {
    const row = await findInvitationRow(transaction, {
      tenantId: DEFAULT_TENANT_ID,
      tokenHash: hashSessionToken(request.token),
    });
    // Deleting first means a second click on the same link finds nothing.
    if (!row || row.expiresAt <= now || !(await deleteInvitationRow(transaction, row.id))) {
      throw new InvitationLinkInvalidError();
    }
    if (await findUserByEmail(transaction, DEFAULT_TENANT_ID, row.email)) {
      throw new EmailAlreadyUsedHttpError(row.email);
    }
    const created = await insertUser(transaction, {
      email: row.email,
      name: request.name,
      passwordHash,
    });
    await assignRoleToUser(transaction, created.id, row.roleId);
    return { user: created, invitation: row };
  });

  const result = await startSignedInSession(server.database, user, userAgent, now);
  return { ...result, invitation };
}

async function findUsableInvitation(server: FastifyInstance, token: string, now: Date) {
  const row = await findInvitationRow(server.database, {
    tenantId: DEFAULT_TENANT_ID,
    tokenHash: hashSessionToken(token),
  });
  if (!row || row.expiresAt <= now) {
    throw new InvitationLinkInvalidError();
  }
  return row;
}

async function findInvitationOrFail(server: FastifyInstance, invitationId: string) {
  const row = await findInvitationRow(server.database, {
    tenantId: DEFAULT_TENANT_ID,
    id: invitationId,
  });
  if (!row) {
    throw new InvitationNotFoundError();
  }
  return row;
}

function emailInvitation(server: FastifyInstance, row: InvitationWithNames, token: string): string {
  // After "#", so the token never reaches a server log or a Referer header.
  const link = `${server.adminOrigin}/accept-invitation#token=${token}`;
  const from = row.inviterName ? `${row.inviterName} has` : "You've been";
  sendEmail(server, {
    to: row.email,
    subject: "You're invited to Lintel",
    text: [
      `${from} invited you to help run a website with Lintel, as ${articleFor(row.roleName)} ${row.roleName}.`,
      "",
      "To accept, open this link and choose your name and password. It works for 7 days:",
      "",
      link,
      "",
      "If you weren't expecting this, you can ignore it.",
    ].join("\n"),
  });
  return link;
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function describeInvitation(row: InvitationWithNames, now: Date): InvitationResponse {
  return {
    id: row.id,
    email: row.email,
    role: { id: row.roleId, name: row.roleName },
    invitedBy:
      row.invitedBy && row.inviterName ? { id: row.invitedBy, name: row.inviterName } : null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    expired: row.expiresAt <= now,
  };
}
