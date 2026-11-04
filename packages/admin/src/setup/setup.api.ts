import { apiRequest } from "../api/client.js";
import type { Session } from "../session/session.api.js";

/** What the API says about first-run setup. Matches `GET /setup/status`. */
export type DatabaseKind = "built-in" | "postgres" | "mysql";

export interface SetupStatus {
  /** True until the first account exists. */
  needsSetup: boolean;
  database: {
    kind: DatabaseKind;
    /** "environment" means DATABASE_URL already decided it, so setup doesn't ask. */
    chosenBy: "environment" | "setup" | "default";
  };
  /** True when setup is happening from another computer and must prove it with a code. */
  requiresSetupCode: boolean;
  /** True once setup has finished (it saves the site's name and kind with the account). */
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
  | { kind: "built-in" }
  | ({ kind: "postgres" | "mysql"; createIfMissing: boolean } & PostgresConnection);

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
  kind: "postgres" | "mysql" = "postgres",
): Promise<void> {
  await apiRequest<{ ok: true }>("/setup/database/test", {
    method: "POST",
    body: { ...connection, kind },
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

/** Every answer from the setup screens, as `POST /setup/finish` takes them. */
export interface SetupAnswersToSend {
  /** Left out when DATABASE_URL already chose the database. */
  database?: DatabaseChoice;
  account: FirstAccountDetails;
  site: { siteName: string; siteType: SiteType };
}

/**
 * Applies every setup answer at once: the database, the owner's account, the site's name and
 * features. The API signs the new owner in, as sign-in does. A problem with one step's
 * answers comes back as an ApiError whose `details.step` names that step.
 */
export function finishSetup(answers: SetupAnswersToSend, setupCode: SetupCode): Promise<Session> {
  return apiRequest<Session>("/setup/finish", {
    method: "POST",
    body: answers,
    headers: setupCodeHeader(setupCode),
  });
}

function setupCodeHeader(setupCode: SetupCode): Record<string, string> | undefined {
  return setupCode ? { "x-lintel-setup-code": setupCode } : undefined;
}

/** The calls the setup screens make, gathered so tests can hand in fakes. */
export const setupApi = {
  testDatabaseConnection,
  finishSetup,
};
export type SetupApi = typeof setupApi;
