import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  MIGRATIONS_FOLDER,
  type OpenedDatabase,
  type PluginMigrations,
  pluginMigrationsTable,
} from "./client.js";
import * as schema from "./schema.js";

/** A Postgres server described field by field, as the setup screen collects it. */
export interface PostgresConnectionDetails {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface PostgresOptions {
  /** How long to wait for the server to answer. postgres' own default is 30 seconds. */
  connectTimeoutSeconds?: number;
}

/**
 * Builds a connection URL from separate fields. The user, password and database name are
 * percent-encoded here, so nobody has to know that a "#" in a password must be "%23".
 */
export function buildPostgresUrl(details: PostgresConnectionDetails): string {
  // An IPv6 address such as ::1 has to be wrapped in brackets inside a URL.
  const host = details.host.includes(":") ? `[${details.host}]` : details.host;
  const user = encodeURIComponent(details.user);
  const password = details.password ? `:${encodeURIComponent(details.password)}` : "";
  const database = encodeURIComponent(details.database);
  const ssl = details.ssl ? "?sslmode=require" : "";

  return `postgres://${user}${password}@${host}:${details.port}/${database}${ssl}`;
}

/**
 * Opens a connection pool to a Postgres server. Connections open on the first query,
 * so this never fails by itself; call `checkPostgresConnection` to find out early.
 */
export function connectToPostgres(databaseUrl: string, options: PostgresOptions = {}) {
  const connection = postgres(databaseUrl, connectionOptions(options));
  const database = drizzle(connection, { schema });

  const opened: OpenedDatabase = {
    database,
    kind: "postgres",
    applyMigrations: () => applyPostgresMigrations(databaseUrl, options),
    applyPluginMigrations: (plugins) => applyPluginMigrations(databaseUrl, options, plugins),
    close: () => connection.end(),
  };
  return opened;
}

/** Connects once and runs a trivial query, so a wrong password shows up straight away. */
export async function checkPostgresConnection(
  databaseUrl: string,
  options: PostgresOptions = {},
): Promise<void> {
  const connection = postgres(databaseUrl, { ...connectionOptions(options), max: 1 });
  try {
    await connection`select 1`;
  } finally {
    await connection.end();
  }
}

/**
 * Creates a database that doesn't exist yet. You can't create a database while connected
 * to it, so this connects to "postgres", the maintenance database every server has.
 */
export async function createPostgresDatabase(
  details: PostgresConnectionDetails,
  options: PostgresOptions = {},
): Promise<void> {
  const maintenanceUrl = buildPostgresUrl({ ...details, database: "postgres" });
  const connection = postgres(maintenanceUrl, { ...connectionOptions(options), max: 1 });
  try {
    await connection`create database ${connection(details.database)}`;
  } finally {
    await connection.end();
  }
}

async function applyPostgresMigrations(databaseUrl: string, options: PostgresOptions) {
  const connection = postgres(databaseUrl, { ...connectionOptions(options), max: 1 });
  try {
    await migrate(drizzle(connection), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await connection.end();
  }
}

async function applyPluginMigrations(
  databaseUrl: string,
  options: PostgresOptions,
  plugins: readonly PluginMigrations[],
) {
  if (plugins.length === 0) return;
  const connection = postgres(databaseUrl, { ...connectionOptions(options), max: 1 });
  try {
    for (const { pluginId, migrationsFolder } of plugins) {
      await migrate(drizzle(connection), {
        migrationsFolder,
        migrationsTable: pluginMigrationsTable(pluginId),
      });
    }
  } finally {
    await connection.end();
  }
}

function connectionOptions(options: PostgresOptions) {
  return {
    // Postgres sends "already exists, skipping" notices every time migrations run after
    // the first. They are expected, and printing them only worries people.
    onnotice: () => {},
    ...(options.connectTimeoutSeconds ? { connect_timeout: options.connectTimeoutSeconds } : {}),
  };
}
