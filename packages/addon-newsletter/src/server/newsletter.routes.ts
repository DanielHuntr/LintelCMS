import {
  ADDON_PUBLIC_PREFIX,
  HttpError,
  parseRequest,
  type PluginServer,
  requirePermission,
} from "@lintel/core/plugin";
import { TooManySignUpsError } from "./newsletter.errors.js";
import type { FetchFunction } from "./newsletter-providers.js";
import { connectionInputSchema, listsRequestSchema } from "./newsletter.schema.js";
import {
  disconnect,
  listProviderLists,
  readConnection,
  readSignUp,
  saveConnection,
  signedUpMessage,
  signUp,
} from "./newsletter.service.js";
import { plainAnswerPage } from "./signup-form.js";

/**
 * HTTP only. Lintel answers 404 PLUGIN_NOT_ENABLED for all of these while the add-on is off.
 *
 *   GET    /newsletter/connection  (settings:read)    -> ConnectionSummary (never the key)
 *   PUT    /newsletter/connection  (settings:update)  { provider, apiKey?, listId, doubleOptIn, brevoTemplateId?, brevoConfirmUrl? }
 *   DELETE /newsletter/connection  (settings:update)  -> 204
 *   POST   /newsletter/lists       (settings:update)  { provider, apiKey? } -> { lists: [{ id, name }] }
 *
 * For visitors, at the website's own address as /_lintel/api/addons/newsletter/subscribe:
 *
 *   POST /delivery/add-ons/newsletter/subscribe  JSON or a plain form post
 *        { email, name?, consent, website (left empty) } -> { message }
 */

/** The parts of a request and reply these routes use. */
interface RequestHeaders {
  headers: { accept?: string; referer?: string };
}
interface PageReply {
  code(status: number): PageReply;
  type(contentType: string): PageReply;
  send(body: string): PageReply;
}

export interface NewsletterRoutesOptions {
  fetch: FetchFunction;
  /** Sign-ups one address may send in a minute. */
  signUpsPerMinute: number;
}

const URL_ENCODED = "application/x-www-form-urlencoded";

export function newsletterRoutes(options: NewsletterRoutesOptions) {
  return async function registerNewsletterRoutes(server: PluginServer) {
    const canRead = { preHandler: requirePermission("settings:read") };
    const canChange = { preHandler: requirePermission("settings:update") };

    server.get("/newsletter/connection", canRead, async (request, reply) =>
      reply.header("cache-control", "no-store").send(await readConnection(server.database)),
    );

    server.put("/newsletter/connection", canChange, async (request) =>
      saveConnection(
        server.database,
        options.fetch,
        parseRequest(connectionInputSchema, request.body),
      ),
    );

    server.delete("/newsletter/connection", canChange, async (_request, reply) => {
      await disconnect(server.database);
      return reply.code(204).send();
    });

    server.post("/newsletter/lists", canChange, async (request) => ({
      lists: await listProviderLists(
        server.database,
        options.fetch,
        parseRequest(listsRequestSchema, request.body),
      ),
    }));

    // A form posted without JavaScript arrives URL-encoded.
    if (!server.hasContentTypeParser(URL_ENCODED)) {
      server.addContentTypeParser(
        URL_ENCODED,
        { parseAs: "string", bodyLimit: 16 * 1024 },
        (_request, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))),
      );
    }

    // Built apart so the rate limit's settings (read by @fastify/rate-limit, which Lintel
    // registers) aren't checked against Fastify's own route options type.
    const signUpRouteOptions = {
      config: {
        rateLimit: {
          max: options.signUpsPerMinute,
          timeWindow: "1 minute",
          errorResponseBuilder: () => new TooManySignUpsError(),
        },
      },
    };

    server.post(
      `${ADDON_PUBLIC_PREFIX}/newsletter/subscribe`,
      signUpRouteOptions,
      async (request, reply) => {
        const wantsPage = asksForPage(request);
        reply.header("cache-control", "no-store");
        try {
          const { person, isRobot } = readSignUp(request.body);
          // A robot filled in the hidden field: thank it as if it worked, and do nothing.
          const answer = isRobot
            ? { message: signedUpMessage(false) }
            : await signUp(server.database, options.fetch, person);
          return wantsPage ? sendPage(reply, request, 200, answer.message) : answer;
        } catch (error) {
          if (wantsPage && error instanceof HttpError) {
            return sendPage(reply, request, error.statusCode, error.message);
          }
          throw error;
        }
      },
    );
  };
}

/** A browser posting a plain form asks for HTML; the script and API clients ask for JSON. */
function asksForPage(request: RequestHeaders): boolean {
  const accept = request.headers.accept ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

function sendPage(reply: PageReply, request: RequestHeaders, status: number, message: string) {
  const referer = request.headers.referer;
  const backTo = typeof referer === "string" && /^https?:\/\//.test(referer) ? referer : undefined;
  return reply.code(status).type("text/html; charset=utf-8").send(plainAnswerPage(message, backTo));
}
