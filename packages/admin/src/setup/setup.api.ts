import { apiRequest } from "../api/client.js";
import type { Session } from "../session/session.api.js";

/** What the API says about first-run setup. Matches `GET /setup/status`. */
export interface SetupStatus {
  /** True until the first account exists. */
  needsSetup: boolean;
  database: {
    kind: "built-in" | "postgres";
    /** "environment" means DATABASE_URL already decided it, so setup doesn't ask. */
    chosenBy: "environment" | "setup" | "default";
  };
  /** True when setup is happening from another computer and must prove it with a code. */
  requiresSetupCode: boolean;
  /** False until "What are you building?" has been answered (or skipped). */
  siteSetupCompleted: boolean;
}

export interface PostgresConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export type DatabaseChoice =
  { kind: "built-in" } | ({ kind: "postgres"; createIfMissing: boolean } & PostgresConnection);

export interface FirstAccountDetails {
  name: string;
  email: string;
  password: string;
}

/**
 * The setup code proves the person can see the terminal Lintel runs in. It is undefined when
 * the API doesn't ask for one (setting up on the same computer).
 */
export type SetupCode = string | undefined;

export function fetchSetupStatus(): Promise<SetupStatus> {
  return apiRequest<SetupStatus>("/setup/status");
}

export async function testDatabaseConnection(
  connection: PostgresConnection,
  setupCode: SetupCode,
): Promise<void> {
  await apiRequest<{ ok: true }>("/setup/database/test", {
    method: "POST",
    body: connection,
    headers: setupCodeHeader(setupCode),
  });
}

export async function chooseDatabase(choice: DatabaseChoice, setupCode: SetupCode): Promise<void> {
  await apiRequest<unknown>("/setup/database", {
    method: "POST",
    body: choice,
    headers: setupCodeHeader(setupCode),
  });
}

/** Creates the first admin account. The API signs the new person in, as sign-in does. */
export function createFirstAccount(
  details: FirstAccountDetails,
  setupCode: SetupCode,
): Promise<Session> {
  return apiRequest<Session>("/setup", {
    method: "POST",
    body: details,
    headers: setupCodeHeader(setupCode),
  });
}

export type SiteType = "business" | "blog" | "shop" | "portfolio" | "blank";

/** A feature that can be switched on. Matches an entry of `GET /plugins`. */
export interface Plugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export async function fetchPlugins(): Promise<Plugin[]> {
  const { plugins } = await apiRequest<{ plugins: Plugin[] }>("/plugins");
  return plugins;
}

/** Saves what the site is for and which plugins to switch on. */
export async function saveSiteSetup(
  siteType: SiteType,
  plugins: string[],
  setupCode: SetupCode,
): Promise<void> {
  await apiRequest<unknown>("/setup/site", {
    method: "POST",
    body: { siteType, plugins },
    headers: setupCodeHeader(setupCode),
  });
}

function setupCodeHeader(setupCode: SetupCode): Record<string, string> | undefined {
  return setupCode ? { "x-lintel-setup-code": setupCode } : undefined;
}

/** The calls the setup screens make, gathered so tests can hand in fakes. */
export const setupApi = {
  testDatabaseConnection,
  chooseDatabase,
  createFirstAccount,
  saveSiteSetup,
};
export type SetupApi = typeof setupApi;
