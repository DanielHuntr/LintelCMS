import type { FastifyInstance, FastifyRequest } from "fastify";
import { signInRateLimit } from "../auth/auth.routes.js";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { setSessionCookie } from "../auth/session-cookie.js";
import { parseRequest } from "../http/http-errors.js";
import type { SecurityEventKind } from "../security-log/security-events.table.js";
import { recordSecurityEvent, requestOrigin } from "../security-log/security-log.service.js";
import { InvitationNotFoundError } from "./invitations.errors.js";
import {
  acceptInvitationRequestSchema,
  createInvitationRequestSchema,
  invitationIdParamsSchema,
  invitationTokenRequestSchema,
} from "./invitations.schema.js";
import {
  acceptInvitation,
  inviteSomeone,
  listInvitations,
  previewInvitation,
  resendInvitation,
  revokeInvitation,
} from "./invitations.service.js";

/**
 * HTTP only:
 *
 *   GET    /invitations             (users:read)    -> { invitations: [Invitation] }
 *   POST   /invitations             (users:invite)  { email, roleId } -> 201 { invitation, invitationUrl }
 *   POST   /invitations/:id/resend  (users:invite)  -> { invitation, invitationUrl }
 *   DELETE /invitations/:id         (users:invite)  -> 204
 *   POST   /invitations/preview     anyone          { token } -> { email, roleName, invitedByName }
 *   POST   /invitations/accept      anyone          { token, name, password } -> { user, permissions } and the cookie
 */
export async function invitationsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("users:read") };
  const canInvite = { preHandler: requirePermission("users:invite") };

  server.get("/invitations", canRead, async () => ({
    invitations: await listInvitations(server),
  }));

  server.post("/invitations", canInvite, async (request, reply) => {
    const invitationRequest = parseRequest(createInvitationRequestSchema, request.body);
    const sent = await inviteSomeone(server, getSignedIn(request), invitationRequest);
    await logInvitationEvent(
      request,
      "user-invited",
      sent.invitation.email,
      sent.invitation.role.name,
    );
    return reply.code(201).header("cache-control", "no-store").send(sent);
  });

  server.post("/invitations/:id/resend", canInvite, async (request, reply) => {
    const sent = await resendInvitation(server, readInvitationId(request.params));
    await logInvitationEvent(
      request,
      "user-invited",
      sent.invitation.email,
      sent.invitation.role.name,
    );
    return reply.header("cache-control", "no-store").send(sent);
  });

  server.delete("/invitations/:id", canInvite, async (request, reply) => {
    const revoked = await revokeInvitation(server, readInvitationId(request.params));
    await logInvitationEvent(request, "invitation-revoked", revoked.email, revoked.roleName);
    return reply.code(204).send();
  });

  server.post("/invitations/preview", { config: signInRateLimit }, async (request) => {
    const { token } = parseRequest(invitationTokenRequestSchema, request.body);
    return previewInvitation(server, token);
  });

  server.post("/invitations/accept", { config: signInRateLimit }, async (request, reply) => {
    const acceptRequest = parseRequest(acceptInvitationRequestSchema, request.body);
    const origin = requestOrigin(request);
    const { session, signedIn, invitation } = await acceptInvitation(
      server,
      acceptRequest,
      origin.userAgent ?? undefined,
    );
    await recordSecurityEvent(server.database, {
      kind: "invitation-accepted",
      actor: { id: signedIn.user.id, email: signedIn.user.email },
      origin,
      details: { role: invitation.roleName },
    });
    setSessionCookie(reply, session.token, session.expiresAt);
    return signedIn;
  });
}

function readInvitationId(params: unknown): string {
  const parsed = invitationIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new InvitationNotFoundError();
  }
  return parsed.data.id;
}

async function logInvitationEvent(
  request: FastifyRequest,
  kind: SecurityEventKind,
  email: string,
  roleName: string,
) {
  const { user } = getSignedIn(request);
  await recordSecurityEvent(request.server.database, {
    kind,
    actor: { id: user.id, email: user.email },
    origin: requestOrigin(request),
    details: { email, role: roleName },
  });
}
