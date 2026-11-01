import type { FastifyInstance } from "fastify";
import { parseRequest } from "../http/http-errors.js";
import { requestOrigin } from "../security-log/security-log.service.js";
import { TooManyResetRequestsError } from "./password-reset.errors.js";
import {
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  resetTokenRequestSchema,
} from "./password-reset.schema.js";
import {
  isResetLinkUsable,
  requestPasswordReset,
  resetPasswordWithLink,
} from "./password-reset.service.js";

const limit = (max: number, timeWindow: string) => ({
  rateLimit: {
    max,
    timeWindow,
    errorResponseBuilder: (_request: unknown, context: { after: string }) =>
      new TooManyResetRequestsError(context.after),
  },
});

/** The same words whether or not there is an account, so nothing can be learned from them. */
export const FORGOT_PASSWORD_ANSWER =
  "If there is an account with that email, we've sent it a link to reset the password. It works for 30 minutes.";

/**
 * HTTP only:
 *
 *   POST /auth/forgot-password       { email } -> 202 { message } (always the same)
 *   POST /auth/reset-password/check  { token } -> { usable }
 *   POST /auth/reset-password        { token, newPassword } -> 204, every session ended
 *
 * Limited per IP address: 5 requests for a link and 10 resets per 15 minutes.
 */
export async function passwordResetRoutes(server: FastifyInstance) {
  server.post(
    "/auth/forgot-password",
    { config: limit(5, "15 minutes") },
    async (request, reply) => {
      const { email } = parseRequest(forgotPasswordRequestSchema, request.body);
      await requestPasswordReset(server, email, requestOrigin(request));
      return reply.code(202).send({ message: FORGOT_PASSWORD_ANSWER });
    },
  );

  server.post(
    "/auth/reset-password/check",
    { config: limit(30, "15 minutes") },
    async (request) => {
      const { token } = parseRequest(resetTokenRequestSchema, request.body);
      return { usable: await isResetLinkUsable(server, token) };
    },
  );

  server.post(
    "/auth/reset-password",
    { config: limit(10, "15 minutes") },
    async (request, reply) => {
      const resetRequest = parseRequest(resetPasswordRequestSchema, request.body);
      await resetPasswordWithLink(server, resetRequest, requestOrigin(request));
      return reply.code(204).send();
    },
  );
}
