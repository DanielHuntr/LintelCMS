import type { FastifyInstance, FastifyRequest } from "fastify";
import { prettifyError } from "zod";
import { setSessionCookie } from "../auth/session-cookie.js";
import { type FieldMessages, InvalidRequestError, parseRequest } from "../http/http-errors.js";
import { isLocalRequest, SETUP_CODE_HEADER, setupCodeMatches } from "./setup-code.js";
import { testPostgresConnection } from "./setup-database.service.js";
import {
  SetupAlreadyDoneError,
  SetupCodeInvalidError,
  SetupCodeRequiredError,
  SetupStepError,
  TooManySetupAttemptsError,
} from "./setup.errors.js";
import {
  type FinishSetupRequest,
  finishSetupRequestSchema,
  type SetupStep,
  setupSteps,
  testDatabaseRequestSchema,
} from "./setup.schema.js";
import { findSetupStatus, finishSetup, isSetupNeeded } from "./setup.service.js";

/** The same limit as sign-in: plenty for a person, far too few for a script guessing codes. */
const SETUP_ATTEMPTS_PER_MINUTE = 10;

/**
 * HTTP only. Everything except the status works only until the first user exists:
 *
 *   GET  /setup/status         -> { needsSetup, database, requiresSetupCode, siteSetupCompleted }
 *   POST /setup/database/test  { host, port, database, user, password, ssl } -> { ok: true }
 *   POST /setup/finish         { database?, account, site } -> 201 { user, permissions, ... }
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

  server.post("/setup/finish", firstRunOnly, async (request, reply) => {
    const answers = parseSetupAnswers(request.body);
    const { session, signedIn } = await oneAtATime(() =>
      finishSetup(
        server.activeDatabase,
        server.lintelFolder,
        server.plugins,
        answers,
        request.headers["user-agent"],
      ),
    );

    setSessionCookie(reply, session.token, session.expiresAt);
    return reply.code(201).send(signedIn);
  });
}

/**
 * Like parseRequest, but a problem is labelled with the step whose answer is wrong (the
 * first one, in screen order), with a message per field of that step.
 */
function parseSetupAnswers(body: unknown): FinishSetupRequest {
  const result = finishSetupRequestSchema.safeParse(body);
  if (result.success) return result.data;

  const stepOf = (path: readonly PropertyKey[]): SetupStep =>
    setupSteps.find((step) => step === path[0]) ?? "account";
  const issues = result.error.issues;
  const step = setupSteps.find((candidate) =>
    issues.some((issue) => stepOf(issue.path) === candidate),
  );
  const fields: FieldMessages = {};
  for (const issue of issues) {
    const field = issue.path.at(-1);
    if (stepOf(issue.path) === step && typeof field === "string") fields[field] ??= issue.message;
  }
  throw new SetupStepError(
    step ?? "account",
    new InvalidRequestError(prettifyError(result.error)),
    fields,
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
