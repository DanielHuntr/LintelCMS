import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requireAccountSession } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import type { SecurityEventKind } from "../security-log/security-events.table.js";
import { recordSecurityEvent, requestOrigin } from "../security-log/security-log.service.js";
import { confirmTwoFactorRequestSchema, passwordConfirmationSchema } from "./two-factor.schema.js";
import {
  confirmTwoFactorSetup,
  describeTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from "./two-factor.service.js";

/** Typing a wrong code a few times is normal; a script trying all million is not. */
const CODE_ATTEMPTS_PER_MINUTE = 10;

/**
 * HTTP only. Each acts on the signed-in person's own account:
 *
 *   GET  /account/two-factor                 -> { enabled, required, recoveryCodesLeft }
 *   POST /account/two-factor/setup           -> { secret, otpauthUrl, qrCodeSvg }
 *   POST /account/two-factor/confirm         { code } -> { recoveryCodes }
 *   POST /account/two-factor/disable         { password } -> 204
 *   POST /account/two-factor/recovery-codes  { password } -> { recoveryCodes }
 */
/** Password checks allowed from one address per 15 minutes, as for changing the password. */
const PASSWORD_ATTEMPTS = 10;

export async function twoFactorRoutes(server: FastifyInstance) {
  const signedIn = { preHandler: requireAccountSession };
  // Turning it off and making new codes check the password, so guesses are limited as for
  // changing the password itself (LINTEL-SEC-013).
  const withPassword = {
    preHandler: requireAccountSession,
    config: { rateLimit: { max: PASSWORD_ATTEMPTS, timeWindow: "15 minutes" } },
  };

  server.get("/account/two-factor", signedIn, async (request) =>
    describeTwoFactor(server.database, getSignedIn(request).user.id),
  );

  server.post("/account/two-factor/setup", signedIn, async (request, reply) => {
    const setup = await startTwoFactorSetup(server.database, getSignedIn(request).user);
    // The key is a secret; nothing in between should keep a copy.
    return reply.header("cache-control", "no-store").send(setup);
  });

  server.post(
    "/account/two-factor/confirm",
    {
      preHandler: requireAccountSession,
      config: { rateLimit: { max: CODE_ATTEMPTS_PER_MINUTE, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { code } = parseRequest(confirmTwoFactorRequestSchema, request.body);
      const result = await confirmTwoFactorSetup(
        server.database,
        getSignedIn(request).user.id,
        code,
      );
      await logOwnEvent(request, "two-factor-enabled");
      return reply.header("cache-control", "no-store").send(result);
    },
  );

  server.post("/account/two-factor/disable", withPassword, async (request, reply) => {
    const { password } = parseRequest(passwordConfirmationSchema, request.body);
    await disableTwoFactor(server.database, getSignedIn(request).user.id, password);
    await logOwnEvent(request, "two-factor-disabled");
    return reply.code(204).send();
  });

  server.post("/account/two-factor/recovery-codes", withPassword, async (request, reply) => {
    const { password } = parseRequest(passwordConfirmationSchema, request.body);
    const result = await regenerateRecoveryCodes(
      server.database,
      getSignedIn(request).user.id,
      password,
    );
    await logOwnEvent(request, "recovery-codes-created");
    return reply.header("cache-control", "no-store").send(result);
  });
}

export async function logOwnEvent(request: FastifyRequest, kind: SecurityEventKind) {
  const { user } = getSignedIn(request);
  await recordSecurityEvent(request.server.database, {
    kind,
    actor: { id: user.id, email: user.email },
    origin: requestOrigin(request),
  });
}
