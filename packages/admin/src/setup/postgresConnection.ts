import { t } from "../i18n/strings.js";
import type { PostgresConnection } from "./setup.api.js";

/** The Postgres fields as typed: the port is still text until it's checked. */
export interface PostgresForm {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  createIfMissing: boolean;
}

export type ConnectionField = "host" | "port" | "database" | "user" | "password";
export type ConnectionErrors = Partial<Record<ConnectionField, string>>;

/** The usual values for Postgres on the same computer, so many people only add a password. */
export const defaultPostgresForm: PostgresForm = {
  host: "localhost",
  port: "5432",
  database: "lintel",
  user: "postgres",
  password: "",
  ssl: false,
  createIfMissing: true,
};

/** The connection to send, or what to fix first. The password may be empty (trust auth). */
export function readPostgresForm(
  form: PostgresForm,
): { connection: PostgresConnection; errors?: undefined } | { errors: ConnectionErrors } {
  const host = form.host.trim();
  const database = form.database.trim();
  const user = form.user.trim();
  const port = Number(form.port.trim());

  const errors: ConnectionErrors = {};
  if (!host) errors.host = t("database.hostMissing");
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = t("database.portInvalid");
  if (!database) errors.database = t("database.nameMissing");
  if (!user) errors.user = t("database.userMissing");

  if (Object.keys(errors).length > 0) return { errors };
  return { connection: { host, port, database, user, password: form.password, ssl: form.ssl } };
}

/**
 * The field an API error is about, so its message appears where the fix is.
 * Undefined means the message goes in the status line.
 */
export function fieldForDatabaseError(code: string | undefined): ConnectionField | undefined {
  switch (code) {
    case "DATABASE_AUTH_FAILED":
      return "password";
    case "DATABASE_NOT_FOUND":
      return "database";
    case "DATABASE_UNREACHABLE":
      return "host";
    default:
      return undefined;
  }
}

/** Where to show a problem from the API: on a connection field, or in the status line. */
export function placeDatabaseProblem(problem: { code?: string; message: string }): {
  errors: ConnectionErrors;
  statusMessage: string;
  field?: ConnectionField;
} {
  const field = fieldForDatabaseError(problem.code);
  return field
    ? { errors: { [field]: problem.message }, statusMessage: "", field }
    : { errors: {}, statusMessage: problem.message };
}
