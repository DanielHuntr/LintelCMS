import type { FastifyInstance, FastifyRequest } from "fastify";
import { NotSignedInError } from "../auth/auth.errors.js";
import { findSignedIn } from "../auth/auth.service.js";
import { getSignedIn, requirePersonInBrowser } from "../auth/require-permission.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { CrossSiteRequestRefusedError } from "../http/cross-site-requests.js";
import { assetFileUrl } from "../media/asset-response.js";
import { findAssetById } from "../media/media.repository.js";
import { findUserById } from "../users/users.repository.js";
import type { OpeningConnection } from "./collaboration-hub.js";
import type { LiveSocket } from "./live-connection.js";

const AVATAR_SIZE = 96;

/**
 * GET /live: the live connection (a WebSocket), one per browser.
 *
 * It needs the session cookie of someone signed in (an API token isn't accepted: this is for
 * people in the admin), from a page on the admin's or the API's own address. Browsers send
 * the session cookie with a WebSocket from any website, so `Origin` is what stops another
 * site using someone's session here, and a request without one is refused too.
 */
export async function collaborationRoutes(
  server: FastifyInstance,
  options: { trustedOrigins: readonly string[] },
) {
  const trusted = new Set(options.trustedOrigins.map((origin) => new URL(origin).origin));
  const opening = new WeakMap<FastifyRequest, Omit<OpeningConnection, "socket">>();

  async function checkOrigin(request: FastifyRequest): Promise<void> {
    const { origin } = request.headers;
    if (origin === undefined || !trusted.has(origin)) throw new CrossSiteRequestRefusedError();
  }

  /** Everything the database has to say comes first, while this is still a plain request. */
  async function readPerson(request: FastifyRequest): Promise<void> {
    const signedIn = getSignedIn(request);
    const token = readSessionToken(request);
    const user = await findUserById(server.database, signedIn.user.id);
    if (!token || !user) throw new NotSignedInError();
    const avatar = user.avatarAssetId
      ? await findAssetById(server.database, user.tenantId, user.avatarAssetId)
      : undefined;
    opening.set(request, {
      person: {
        id: user.id,
        name: user.name,
        avatarUrl: avatar
          ? assetFileUrl(server.publicApiUrl, avatar, {
              w: AVATAR_SIZE,
              h: AVATAR_SIZE,
              fit: "cover",
              format: "webp",
            })
          : null,
      },
      signedIn,
      tenantId: user.tenantId,
      findSignedIn: async () => (await findSignedIn(server.database, token))?.signedIn,
    });
  }

  server.get(
    "/live",
    { websocket: true, preHandler: [requirePersonInBrowser, checkOrigin, readPerson] },
    // Not async: a browser can speak the moment the socket opens, and a message that arrives
    // before anything is listening is gone, so nothing may be awaited before `open`.
    (socket, request) => {
      const details = opening.get(request);
      if (!details) {
        socket.close();
        return;
      }
      server.collaboration.open({ socket: socket as unknown as LiveSocket, ...details });
    },
  );
}
