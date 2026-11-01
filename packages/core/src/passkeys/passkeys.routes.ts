import type { FastifyInstance, FastifyRequest } from "fastify";
import { recordSignInEvent } from "../auth/auth.service.js";
import { signInRateLimit } from "../auth/auth.routes.js";
import { getSignedIn, requireAccountSession } from "../auth/require-permission.js";
import { setSessionCookie } from "../auth/session-cookie.js";
import { parseRequest } from "../http/http-errors.js";
import { recordSecurityEvent, requestOrigin } from "../security-log/security-log.service.js";
import { PasskeyNotFoundError } from "./passkeys.errors.js";
import {
  addPasskeyRequestSchema,
  passkeyIdParamsSchema,
  passkeySignInRequestSchema,
} from "./passkeys.schema.js";
import {
  finishPasskeyRegistration,
  finishPasskeySignIn,
  listPasskeys,
  relyingPartyFor,
  removePasskey,
  startPasskeyRegistration,
  startPasskeySignIn,
} from "./passkeys.service.js";

/**
 * HTTP only:
 *
 *   GET    /account/passkeys          (signed in)  -> { passkeys: [{ id, name, createdAt, lastUsedAt }] }
 *   POST   /account/passkeys/options  (signed in)  -> WebAuthn creation options
 *   POST   /account/passkeys          (signed in)  { name, response } -> 201 Passkey
 *   DELETE /account/passkeys/:id      (signed in)  -> 204
 *   POST   /auth/passkey/options                   -> WebAuthn request options
 *   POST   /auth/passkey/sign-in                   { response } -> { user, permissions } and the cookie
 */
export async function passkeysRoutes(server: FastifyInstance) {
  const signedIn = { preHandler: requireAccountSession };
  const relyingParty = () => relyingPartyFor(server.adminOrigin);

  server.get("/account/passkeys", signedIn, async (request) => ({
    passkeys: await listPasskeys(server.database, getSignedIn(request).user.id),
  }));

  server.post("/account/passkeys/options", signedIn, async (request) =>
    startPasskeyRegistration(server.database, relyingParty(), getSignedIn(request).user),
  );

  server.post("/account/passkeys", signedIn, async (request, reply) => {
    const passkeyRequest = parseRequest(addPasskeyRequestSchema, request.body);
    const passkey = await finishPasskeyRegistration(
      server.database,
      relyingParty(),
      getSignedIn(request).user,
      passkeyRequest,
    );
    await logPasskeyEvent(request, "passkey-added", passkey.name);
    return reply.code(201).send(passkey);
  });

  server.delete("/account/passkeys/:id", signedIn, async (request, reply) => {
    const parsed = passkeyIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new PasskeyNotFoundError();
    }
    const removed = await removePasskey(
      server.database,
      getSignedIn(request).user.id,
      parsed.data.id,
    );
    await logPasskeyEvent(request, "passkey-removed", removed.name);
    return reply.code(204).send();
  });

  server.post("/auth/passkey/options", { config: signInRateLimit }, async () =>
    startPasskeySignIn(server.database, relyingParty()),
  );

  server.post("/auth/passkey/sign-in", { config: signInRateLimit }, async (request, reply) => {
    const { response } = parseRequest(passkeySignInRequestSchema, request.body);
    const origin = requestOrigin(request);
    const { session, signedIn } = await finishPasskeySignIn(
      server.database,
      relyingParty(),
      response,
      origin,
    );
    await recordSignInEvent(server.database, signedIn.user, origin, "passkey");
    setSessionCookie(reply, session.token, session.expiresAt);
    return signedIn;
  });
}

async function logPasskeyEvent(
  request: FastifyRequest,
  kind: "passkey-added" | "passkey-removed",
  name: string,
) {
  const { user } = getSignedIn(request);
  await recordSecurityEvent(request.server.database, {
    kind,
    actor: { id: user.id, email: user.email },
    origin: requestOrigin(request),
    details: { passkey: name },
  });
}
