import type { FastifyInstance } from "fastify";
import { hashPassword } from "../auth/passwords.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { sendEmail } from "../email/email.js";
import {
  cancelOneTimeTokens,
  countOneTimeTokensSince,
  findUsableOneTimeToken,
  issueOneTimeToken,
  spendOneTimeToken,
} from "../one-time-tokens/one-time-tokens.service.js";
import { recordSecurityEvent, type RequestOrigin } from "../security-log/security-log.service.js";
import { endAllSessionsForUser } from "../sessions/sessions.service.js";
import { findUserByEmail, findUserById, updatePasswordHash } from "../users/users.repository.js";
import { requireStrongPassword } from "../users/users.service.js";
import { ResetLinkInvalidError } from "./password-reset.errors.js";
import type { ResetPasswordRequest } from "./password-reset.schema.js";

/**
 * "Forgot your password?": an emailed link that works once, for 30 minutes.
 *
 * Asking for a link answers the same way whether or not the email has an account, so the
 * screen can't be used to find out who works here. The email itself is sent in the
 * background (see src/email), so the answer takes the same time too.
 */
export const RESET_LINK_MILLISECONDS = 30 * 60 * 1000;

/** More links than this in half an hour are quietly not sent, so nobody's inbox is flooded. */
const MAX_LINKS_PER_HALF_HOUR = 3;

export async function requestPasswordReset(
  server: FastifyInstance,
  email: string,
  origin: RequestOrigin,
  now = new Date(),
): Promise<void> {
  const database = server.database;
  const user = await findUserByEmail(database, DEFAULT_TENANT_ID, email);
  if (!user || user.status !== "active") {
    return;
  }
  const since = new Date(now.getTime() - RESET_LINK_MILLISECONDS);
  if (
    (await countOneTimeTokensSince(database, user.id, "password-reset", since)) >=
    MAX_LINKS_PER_HALF_HOUR
  ) {
    return;
  }

  const { token } = await issueOneTimeToken(
    database,
    { purpose: "password-reset", userId: user.id, lifetimeMilliseconds: RESET_LINK_MILLISECONDS },
    now,
  );
  // The token goes after "#", which browsers never send to a server or in a Referer.
  const link = `${server.adminOrigin}/reset-password#token=${token}`;
  sendEmail(server, {
    to: user.email,
    subject: "Reset your Lintel password",
    text: [
      `Hello ${user.name},`,
      "",
      "Someone asked to reset the password for your Lintel account. To choose a new one, open this link within 30 minutes:",
      "",
      link,
      "",
      "If it wasn't you, you can ignore this email. Your password hasn't changed.",
    ].join("\n"),
  });
  await recordSecurityEvent(
    database,
    { kind: "password-reset-requested", actor: { id: user.id, email: user.email }, origin },
    now,
  );
}

/** Whether a link can still be used, so the screen can say so before anyone types. */
export async function isResetLinkUsable(
  server: FastifyInstance,
  token: string,
  now = new Date(),
): Promise<boolean> {
  return (
    (await findUsableOneTimeToken(server.database, "password-reset", token, now)) !== undefined
  );
}

/**
 * Sets the new password, spends the link (and any others sent to the same person) and
 * signs them out everywhere, so whoever might have known the old password loses access.
 *
 * The password must pass the same strength rule as everywhere else. It is checked before
 * the link is spent, so an easily guessed password can be replaced without a new email.
 */
export async function resetPasswordWithLink(
  server: FastifyInstance,
  request: ResetPasswordRequest,
  origin: RequestOrigin,
  now = new Date(),
): Promise<void> {
  const unspent = await findUsableOneTimeToken(
    server.database,
    "password-reset",
    request.token,
    now,
  );
  const linkOwner = unspent?.userId
    ? await findUserById(server.database, unspent.userId)
    : undefined;
  if (!linkOwner || linkOwner.status !== "active") {
    throw new ResetLinkInvalidError();
  }
  requireStrongPassword(request.newPassword, linkOwner.name, linkOwner.email);

  const passwordHash = await hashPassword(request.newPassword);
  const user = await server.database.transaction(async (transaction) => {
    const token = await spendOneTimeToken(transaction, "password-reset", request.token, now);
    const owner = token?.userId ? await findUserById(transaction, token.userId) : undefined;
    if (!owner || owner.status !== "active") {
      throw new ResetLinkInvalidError();
    }
    await updatePasswordHash(transaction, owner.id, passwordHash);
    await cancelOneTimeTokens(transaction, owner.id, "password-reset");
    await endAllSessionsForUser(transaction, owner.id);
    return owner;
  });

  await recordSecurityEvent(
    server.database,
    { kind: "password-reset", actor: { id: user.id, email: user.email }, origin },
    now,
  );
  sendEmail(server, {
    to: user.email,
    subject: "Your Lintel password was changed",
    text: [
      `Hello ${user.name},`,
      "",
      "The password for your Lintel account was just reset, and you were signed out everywhere.",
      "",
      "If it wasn't you, ask an admin to deactivate your account straight away.",
    ].join("\n"),
  });
}
