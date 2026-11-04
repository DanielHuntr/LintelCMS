/**
 * Turns the errors a database and the network give us into one sentence a person can act
 * on, instead of a stack trace. Used when the server starts, by the command-line scripts,
 * and by the setup screen's "test connection" button.
 */

import { UNIQUE_VIOLATION_CODES } from "./dialect/database-errors.js";

/** Which kind of problem it is, so the setup screen can point at the right field. */
export type DatabaseProblem = "unreachable" | "auth-failed" | "not-found" | "invalid";

/** Where the connection details came from, which decides what to suggest fixing. */
export type DatabaseSettingsSource = "environment" | "saved-setup" | "form";

export interface DatabaseTarget {
  host: string;
  port: number;
  database: string;
  user: string;
  /** Which kind of server it is. Left out, it's Postgres. */
  kind?: "postgres" | "mysql";
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

/** Whether a database address is for a MySQL or MariaDB server. */
export function isMysqlUrl(databaseUrl: string): boolean {
  return /^(mysql|mariadb):/i.test(databaseUrl);
}

/** Reads the parts of a DATABASE_URL that the messages mention. */
export function targetFromUrl(databaseUrl: string): DatabaseTarget {
  try {
    const url = new URL(databaseUrl);
    if (isMysqlUrl(databaseUrl)) {
      return {
        host: url.hostname || "localhost",
        port: url.port ? Number(url.port) : 3306,
        database: decodeURIComponent(url.pathname.slice(1)),
        user: decodeURIComponent(url.username),
        kind: "mysql",
      };
    }
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
  const server = target.kind === "mysql" ? "MySQL or MariaDB" : "Postgres";

  if (target.kind === "mysql") {
    const mysqlProblem = describeMysqlCode(code, error, target, address);
    if (mysqlProblem) return mysqlProblem;
  }

  switch (code) {
    case "ECONNREFUSED":
      return unreachable(`Lintel can't reach ${server} at ${address}. Is it running?`);
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
        `${server} at ${address} didn't answer. Check the host and port, ` +
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

/** What mysql2 reports, by the names MySQL and MariaDB give their errors. */
function describeMysqlCode(
  code: string,
  error: unknown,
  target: DatabaseTarget,
  address: string,
): DescribedDatabaseError | undefined {
  switch (code) {
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_ACCESS_DENIED_NO_PASSWORD_ERROR":
      return {
        problem: "auth-failed",
        message: `The server at ${address} turned down the user name or password for "${target.user}".`,
      };
    case "ER_DBACCESS_DENIED_ERROR":
      return {
        problem: "auth-failed",
        message: `"${target.user}" isn't allowed to use the database "${target.database}" on the server at ${address}.`,
      };
    case "ER_BAD_DB_ERROR":
      return {
        problem: "not-found",
        message: `There's no database called "${target.database}" on the server at ${address}.`,
      };
    case "HANDSHAKE_NO_SSL_SUPPORT":
      return invalid(
        `The server at ${address} doesn't accept encrypted (SSL) connections. ` +
          "Turn SSL off and try again.",
      );
    case "ER_HOST_NOT_PRIVILEGED":
    case "ER_HOST_IS_BLOCKED":
      return {
        problem: "auth-failed",
        message: `The server at ${address} won't take connections from this computer. Allow it in the server's settings.`,
      };
    case "ER_NOT_SUPPORTED_AUTH_MODE":
      return invalid(
        `The server at ${address} signs people in in a way Lintel can't use. ` +
          "Ask your host to give this user the caching_sha2_password or mysql_native_password method.",
      );
    default:
      return code.startsWith("ER_")
        ? invalid(`The database server reported a problem: ${mysqlMessage(error)}.`)
        : undefined;
  }
}

function mysqlMessage(error: unknown, depth = 0): string {
  if (!(error instanceof Error) || depth > 5) return "no details given";
  if ("sqlMessage" in error && typeof error.sqlMessage === "string") return error.sqlMessage;
  return error.cause ? mysqlMessage(error.cause, depth + 1) : error.message;
}

function mysqlHintFor(problem: DatabaseProblem, target: DatabaseTarget): string | undefined {
  if (problem === "unreachable") {
    return "Start the server, or remove DATABASE_URL to use the built-in database instead.";
  }
  if (problem === "auth-failed") {
    return `Check the user name and password in DATABASE_URL. ${SPECIAL_CHARACTERS_HINT}`;
  }
  if (problem === "not-found") {
    const database = target.database.replaceAll("`", "``");
    return (
      `Create it with: CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 ` +
      "COLLATE utf8mb4_0900_bin (on MariaDB, utf8mb4_nopad_bin); then start Lintel again."
    );
  }
  return undefined;
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
  if (target.kind === "mysql") {
    return mysqlHintFor(problem, target);
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
export function findErrorCode(error: unknown, depth = 0): string | undefined {
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

/**
 * True when a write broke a unique index, optionally a particular one. Services use it to
 * turn a lost race ("someone took that handle a moment ago") into a plain message.
 */
export function isUniqueViolation(error: unknown, indexName?: string): boolean {
  const code = findErrorCode(error);
  if (code === undefined || !UNIQUE_VIOLATION_CODES.includes(code)) {
    return false;
  }
  return indexName === undefined || mentionsConstraint(error, indexName);
}

function mentionsConstraint(error: unknown, indexName: string, depth = 0): boolean {
  if (!(error instanceof Error) || depth > 5) {
    return false;
  }
  const constraint = "constraint" in error ? error.constraint : undefined;
  const constraintName = "constraint_name" in error ? error.constraint_name : undefined;
  if (constraint === indexName || constraintName === indexName) {
    return true;
  }
  return error.message.includes(indexName) || mentionsConstraint(error.cause, indexName, depth + 1);
}
