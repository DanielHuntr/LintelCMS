import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requireAccountSession } from "../auth/require-permission.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { NotSignedInError } from "../auth/auth.errors.js";
import { sendEmail } from "../email/email.js";
import { parseRequest } from "../http/http-errors.js";
import { recordSecurityEvent, requestOrigin } from "../security-log/security-log.service.js";
import { SessionNotFoundError } from "./account.errors.js";
import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  confirmEmailRequestSchema,
  sessionIdParamsSchema,
  updateProfileRequestSchema,
} from "./account.schema.js";
import {
  changePassword,
  confirmEmailChange,
  endAccountSession,
  getAccount,
  listAccountSessions,
  requestEmailChange,
  signOutOtherDevices,
  updateProfile,
} from "./account.service.js";

/**
 * HTTP only. Everything acts on the signed-in person's own account (two-factor and
 * passkeys are in their own folders):
 *
 *   GET    /account                         -> Account
 *   PATCH  /account                         { name?, avatarAssetId? } -> Account
 *   POST   /account/email                   { newEmail, password } -> 202, sends a confirmation link
 *   POST   /account/email/confirm  (anyone) { token } -> 204
 *   POST   /account/password                { currentPassword, newPassword } -> { endedSessions }
 *   GET    /account/sessions                -> { sessions: [{ id, browser, lastUsedAt, current }] }
 *   DELETE /account/sessions/:id            -> 204
 *   POST   /account/sessions/sign-out-others -> { endedSessions }
 */
export async function accountRoutes(server: FastifyInstance) {
  const signedIn = { preHandler: requireAccountSession };
  const userId = (request: FastifyRequest) => getSignedIn(request).user.id;

  server.get("/account", signedIn, async (request) => getAccount(server, userId(request)));

  server.patch("/account", signedIn, async (request) => {
    const changes = parseRequest(updateProfileRequestSchema, request.body);
    return updateProfile(server, userId(request), changes);
  });

  server.post(
    "/account/email",
    {
      preHandler: requireAccountSession,
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      const emailRequest = parseRequest(changeEmailRequestSchema, request.body);
      await requestEmailChange(server, userId(request), emailRequest);
      return reply.code(202).send();
    },
  );

  server.post(
    "/account/email/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const { token } = parseRequest(confirmEmailRequestSchema, request.body);
      const { user, previousEmail } = await confirmEmailChange(server, token);
      await recordSecurityEvent(server.database, {
        kind: "email-changed",
        actor: { id: user.id, email: user.email },
        origin: requestOrigin(request),
        details: { from: previousEmail, to: user.email },
      });
      sendEmail(server, {
        to: previousEmail,
        subject: "Your Lintel email was changed",
        text: `The email for your Lintel account is now ${user.email}. If it wasn't you, tell an admin straight away.`,
      });
      return reply.code(204).send();
    },
  );

  server.post(
    "/account/password",
    {
      preHandler: requireAccountSession,
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    },
    async (request) => {
      const passwordRequest = parseRequest(changePasswordRequestSchema, request.body);
      const endedSessions = await changePassword(
        server.database,
        userId(request),
        currentSessionToken(request),
        passwordRequest,
      );
      await logOwnAccountEvent(request, "password-changed", { endedSessions });
      return { endedSessions };
    },
  );

  server.get("/account/sessions", signedIn, async (request) => ({
    sessions: await listAccountSessions(
      server.database,
      userId(request),
      readSessionToken(request),
    ),
  }));

  server.delete("/account/sessions/:id", signedIn, async (request, reply) => {
    const parsed = sessionIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new SessionNotFoundError();
    }
    await endAccountSession(server.database, userId(request), parsed.data.id);
    await logOwnAccountEvent(request, "sessions-ended", { endedSessions: 1 });
    return reply.code(204).send();
  });

  server.post("/account/sessions/sign-out-others", signedIn, async (request) => {
    const endedSessions = await signOutOtherDevices(
      server.database,
      userId(request),
      currentSessionToken(request),
    );
    await logOwnAccountEvent(request, "sessions-ended", { endedSessions });
    return { endedSessions };
  });
}

function currentSessionToken(request: FastifyRequest): string {
  const token = readSessionToken(request);
  if (!token) {
    throw new NotSignedInError();
  }
  return token;
}

async function logOwnAccountEvent(
  request: FastifyRequest,
  kind: "password-changed" | "sessions-ended",
  details: Record<string, number>,
) {
  const { user } = getSignedIn(request);
  await recordSecurityEvent(request.server.database, {
    kind,
    actor: { id: user.id, email: user.email },
    origin: requestOrigin(request),
    details,
  });
}
