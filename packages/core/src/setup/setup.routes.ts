import type { FastifyInstance, FastifyRequest } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { setSessionCookie } from "../auth/session-cookie.js";
import { parseRequest } from "../http/http-errors.js";
import { isLocalRequest, SETUP_CODE_HEADER, setupCodeMatches } from "./setup-code.js";
import { chooseDatabase, testPostgresConnection } from "./setup-database.service.js";
import {
  SetupAlreadyDoneError,
  SetupCodeInvalidError,
  SetupCodeRequiredError,
  TooManySetupAttemptsError,
} from "./setup.errors.js";
import {
  chooseDatabaseRequestSchema,
  completeSetupRequestSchema,
  siteSetupRequestSchema,
  testDatabaseRequestSchema,
} from "./setup.schema.js";
import { completeSetup, findSetupStatus, isSetupNeeded } from "./setup.service.js";
import { setUpSite } from "./site-setup.service.js";
import { installedPluginIdListSchema } from "../plugins/plugins.schema.js";

/** The same limit as sign-in: plenty for a person, far too few for a script guessing codes. */
const SETUP_ATTEMPTS_PER_MINUTE = 10;

/**
 * HTTP only. Everything except /setup/site works only until the first user exists:
 *
 *   GET  /setup/status         -> { needsSetup, database, requiresSetupCode, siteSetupCompleted }
 *   POST /setup/database/test  { host, port, database, user, password, ssl } -> { ok: true }
 *   POST /setup/database       { kind: "built-in" } or { kind: "postgres", ..., createIfMissing }
 *   POST /setup                { email, name, password } -> { user, permissions, enabledPlugins }
 *   POST /setup/site           (signed in, settings:update) { siteType, plugins }
 */
export async function setupRoutes(server: FastifyInstance) {
  const firstRunOnly = {
    preHandler: requireSetupAccess,
    config: {
      rateLimit: {
        max: SETUP_ATTEMPTS_PER_MINUTE,
        timeWindow: "1 minute",
        errorResponseBuilder: (_request: FastifyRequest, context: { after: string }) =>
          new TooManySetupAttemptsError(context.after),
      },
    },
  };
  // Choosing a database and creating the first admin each change what the next request
  // sees, so they run one at a time even when two arrive together.
  const oneAtATime = createOneAtATime();

  server.get("/setup/status", async (request) =>
    findSetupStatus(server.activeDatabase, isLocalRequest(request)),
  );

  server.post("/setup/database/test", firstRunOnly, async (request) => {
    const details = parseRequest(testDatabaseRequestSchema, request.body);
    await testPostgresConnection(server.activeDatabase, details);
    return { ok: true };
  });

  server.post("/setup/database", firstRunOnly, async (request) => {
    const choice = parseRequest(chooseDatabaseRequestSchema, request.body);
    return oneAtATime(() => chooseDatabase(server.activeDatabase, server.lintelFolder, choice));
  });

  server.post("/setup", firstRunOnly, async (request, reply) => {
    const admin = parseRequest(completeSetupRequestSchema, request.body);
    const { session, signedIn } = await oneAtATime(() =>
      completeSetup(server.activeDatabase, admin, request.headers["user-agent"]),
    );

    setSessionCookie(reply, session.token, session.expiresAt);
    return reply.code(201).send(signedIn);
  });

  server.post(
    "/setup/site",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const site = parseRequest(
        siteSetupRequestSchema.extend({
          plugins: installedPluginIdListSchema(server.plugins.ids),
        }),
        request.body,
      );
      return setUpSite(server.database, server.plugins, site);
    },
  );
}

/**
 * Guards the first-run endpoints: 409 once someone has an account, and the setup code
 * for requests from another computer (see setup-code.ts).
 */
async function requireSetupAccess(request: FastifyRequest): Promise<void> {
  if (!(await isSetupNeeded(request.server.database))) {
    throw new SetupAlreadyDoneError();
  }
  if (isLocalRequest(request)) {
    return;
  }

  const given = request.headers[SETUP_CODE_HEADER];
  if (typeof given !== "string" || given.trim() === "") {
    throw new SetupCodeRequiredError();
  }
  if (!setupCodeMatches(request.server.setupCode, given)) {
    throw new SetupCodeInvalidError();
  }
}

function createOneAtATime() {
  let previous: Promise<unknown> = Promise.resolve();

  return function runAfterPrevious<Result>(task: () => Promise<Result>): Promise<Result> {
    const result = previous.then(task);
    // The next task waits for this one whether it succeeds or fails.
    previous = result.catch(() => undefined);
    return result;
  };
}
