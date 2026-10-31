/**
 * Turns the errors Postgres and the network give us into one sentence a person can act
 * on, instead of a stack trace. Used when the server starts, by the command-line scripts,
 * and by the setup screen's "test connection" button.
 */

/** Which kind of problem it is, so the setup screen can point at the right field. */
export type DatabaseProblem = "unreachable" | "auth-failed" | "not-found" | "invalid";

/** Where the connection details came from, which decides what to suggest fixing. */
export type DatabaseSettingsSource = "environment" | "saved-setup" | "form";

export interface DatabaseTarget {
  host: string;
  port: number;
  database: string;
  user: string;
}

export interface DescribedDatabaseError {
  problem: DatabaseProblem;
  message: string;
}

const SPECIAL_CHARACTERS_HINT =
  "If the password contains #, @ or /, write them in DATABASE_URL as %23, %40 or %2F.";

/** Returns undefined for errors that aren't about reaching the database. */
export function describeDatabaseError(
  error: unknown,
  target: DatabaseTarget,
  source: DatabaseSettingsSource,
): DescribedDatabaseError | undefined {
  const code = findErrorCode(error);
  const found = code ? describeCode(code, error, target) : undefined;
  if (!found) {
    return undefined;
  }

  const hint = hintFor(found.problem, target, source);
  return { problem: found.problem, message: hint ? `${found.message} ${hint}` : found.message };
}

/** What a readable DATABASE_URL looks like, for when it can't be read at all. */
export const DATABASE_URL_ADVICE =
  "It should look like postgres://user:password@localhost:5432/lintel. " +
  "If the password contains #, @ or /, write them as %23, %40 or %2F.";

export function describeMalformedDatabaseUrl(): string {
  return `DATABASE_URL isn't a valid Postgres address. ${DATABASE_URL_ADVICE}`;
}

/** Reads the parts of a DATABASE_URL that the messages mention. */
export function targetFromUrl(databaseUrl: string): DatabaseTarget {
  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname || "localhost",
      port: url.port ? Number(url.port) : 5432,
      database: decodeURIComponent(url.pathname.slice(1)) || decodeURIComponent(url.username),
      user: decodeURIComponent(url.username),
    };
  } catch {
    return { host: "localhost", port: 5432, database: "", user: "" };
  }
}

function describeCode(
  code: string,
  error: unknown,
  target: DatabaseTarget,
): DescribedDatabaseError | undefined {
  const address = `${target.host}:${target.port}`;

  switch (code) {
    case "ECONNREFUSED":
      return unreachable(`Lintel can't reach Postgres at ${address}. Is it running?`);
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return unreachable(
        `Lintel can't find a computer called "${target.host}". Check the host name for typos.`,
      );
    case "CONNECT_TIMEOUT":
    case "ETIMEDOUT":
    case "EHOSTUNREACH":
    case "ENETUNREACH":
      return unreachable(
        `Postgres at ${address} didn't answer. Check the host and port, ` +
          "and that no firewall is blocking the connection.",
      );
    case "SSL_NOT_SUPPORTED":
      return invalid(
        `The Postgres server at ${address} doesn't accept encrypted (SSL) connections. ` +
          "Turn SSL off and try again.",
      );
    case "28P01":
      return {
        problem: "auth-failed",
        message: `Postgres turned down the password for "${target.user}".`,
      };
    case "28000":
      return {
        problem: "auth-failed",
        message: `Postgres won't let "${target.user}" sign in (${postgresMessage(error)}).`,
      };
    case "3D000":
      return {
        problem: "not-found",
        message: `There's no database called "${target.database}" on the Postgres server at ${address}.`,
      };
    case "ERR_INVALID_URL":
      return invalid(describeMalformedDatabaseUrl());
    default:
      // Any other five-character SQLSTATE is Postgres itself explaining what's wrong.
      return /^[0-9A-Z]{5}$/.test(code)
        ? invalid(`Postgres reported a problem: ${postgresMessage(error)}.`)
        : undefined;
  }
}

function hintFor(
  problem: DatabaseProblem,
  target: DatabaseTarget,
  source: DatabaseSettingsSource,
): string | undefined {
  if (source === "form") {
    return undefined;
  }
  if (source === "saved-setup") {
    return (
      "These settings were chosen during setup and saved in .lintel/config.json. " +
      "Fix them there, or delete that file to go back to the built-in database."
    );
  }

  if (problem === "unreachable") {
    return "Start Postgres (with Docker: `pnpm db:up`), or remove DATABASE_URL to use the built-in database instead.";
  }
  if (problem === "auth-failed") {
    return `Check the user name and password in DATABASE_URL. ${SPECIAL_CHARACTERS_HINT}`;
  }
  if (problem === "not-found") {
    const database = target.database.replaceAll('"', '""');
    return (
      `Create it with \`createdb -h ${target.host} -p ${target.port} -U ${target.user} ${target.database}\`, ` +
      `or in psql: CREATE DATABASE "${database}"; then start Lintel again.`
    );
  }
  return undefined;
}

/**
 * The code can sit on the error itself, on its `cause` (Drizzle wraps failed queries), or
 * inside an AggregateError (Node tries IPv6 and IPv4 for "localhost" and reports both).
 */
function findErrorCode(error: unknown, depth = 0): string | undefined {
  if (!(error instanceof Error) || depth > 5) {
    return undefined;
  }
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if (error instanceof AggregateError) {
    for (const inner of error.errors) {
      const code = findErrorCode(inner, depth + 1);
      if (code) {
        return code;
      }
    }
  }
  return findErrorCode(error.cause, depth + 1);
}

function postgresMessage(error: unknown, depth = 0): string {
  if (!(error instanceof Error) || depth > 5) {
    return "no details given";
  }
  if ("severity" in error) {
    return error.message;
  }
  return error.cause ? postgresMessage(error.cause, depth + 1) : error.message;
}

function unreachable(message: string): DescribedDatabaseError {
  return { problem: "unreachable", message };
}

function invalid(message: string): DescribedDatabaseError {
  return { problem: "invalid", message };
}
