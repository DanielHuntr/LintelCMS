/**
 * The checks behind `lintel doctor`. Each takes what it needs to know (found by
 * doctor-probes.ts on a real machine, made up in tests) and says, in plain English, whether
 * things are fine and what to do if not.
 */
export type CheckStatus = "ok" | "warning" | "problem";

export interface CheckResult {
  title: string;
  status: CheckStatus;
  detail: string;
  /** What to do about it, when it isn't fine. */
  fix?: string;
}

export const REQUIRED_NODE_MAJOR = 22;
export const REQUIRED_PNPM_MAJOR = 10;

function majorOf(version: string): number {
  return Number.parseInt(version.replace(/^v/, "").split(".")[0] ?? "", 10);
}

export function checkNode(version: string): CheckResult {
  const title = "Node.js";
  if (majorOf(version) >= REQUIRED_NODE_MAJOR) {
    return { title, status: "ok", detail: `Version ${version.replace(/^v/, "")}.` };
  }
  return {
    title,
    status: "problem",
    detail: `Version ${version.replace(/^v/, "")} is too old: Lintel needs ${REQUIRED_NODE_MAJOR} or newer.`,
    fix: `Install Node.js ${REQUIRED_NODE_MAJOR} (the "LTS" download on nodejs.org), then open a new terminal.`,
  };
}

export function checkPnpm(version: string | null): CheckResult {
  const title = "pnpm";
  if (version === null) {
    return {
      title,
      status: "problem",
      detail: "pnpm isn't installed, or isn't on this terminal's PATH.",
      fix: "Run: corepack enable  (it comes with Node.js), then open a new terminal.",
    };
  }
  if (majorOf(version) === REQUIRED_PNPM_MAJOR) {
    return { title, status: "ok", detail: `Version ${version}.` };
  }
  return {
    title,
    status: "warning",
    detail: `Version ${version}; Lintel is built and tested with pnpm ${REQUIRED_PNPM_MAJOR}.`,
    fix: "Run: corepack enable  so the repository's own pnpm version is used.",
  };
}

export type SettingsProbe = { ok: true } | { ok: false; message: string };

export function checkSettings(settings: SettingsProbe): CheckResult {
  const title = "Settings";
  if (settings.ok) {
    return {
      title,
      status: "ok",
      detail: "The environment settings (and .env, if any) are readable.",
    };
  }
  return {
    title,
    status: "problem",
    detail: settings.message,
    fix: "Correct the setting named above in .env or the environment, or remove it to use the default.",
  };
}

export type DatabaseProbe =
  | { reachable: true; description: string; appliedMigrations: number }
  | { reachable: false; inUse: boolean; message: string };

export function checkDatabase(database: DatabaseProbe): CheckResult {
  const title = "Database";
  if (database.reachable) {
    return { title, status: "ok", detail: `Lintel can reach ${database.description}.` };
  }
  if (database.inUse) {
    return {
      title,
      status: "warning",
      detail:
        "The built-in database is open in a running Lintel, so it couldn't be checked from here.",
      fix: "That's fine while Lintel is running. Stop it (Ctrl+C) and run doctor again to check the database too.",
    };
  }
  return {
    title,
    status: "problem",
    detail: database.message,
    fix: "Check DATABASE_URL (or the database chosen during setup) and that the database server is running.",
  };
}

export function checkMigrations(
  database: DatabaseProbe,
  knownMigrations: number,
): CheckResult | null {
  if (!database.reachable) {
    return null;
  }
  const title = "Database tables";
  const applied = database.appliedMigrations;
  if (applied === knownMigrations) {
    return { title, status: "ok", detail: `Up to date (${knownMigrations} migrations).` };
  }
  if (applied > knownMigrations) {
    return {
      title,
      status: "problem",
      detail: "The database was used by a newer version of Lintel than this one.",
      fix: "Update Lintel here (git pull, then pnpm install) before starting it.",
    };
  }
  return {
    title,
    status: "warning",
    detail:
      applied === 0
        ? "The database is empty: Lintel hasn't set it up yet."
        : `${knownMigrations - applied} updates to the tables haven't been applied yet.`,
    fix: "Run: pnpm lintel migrate  (or just start Lintel, which does it for you).",
  };
}

export function checkFolder(title: string, folder: string, problem: string | null): CheckResult {
  if (problem === null) {
    return { title, status: "ok", detail: `Lintel can save files in ${folder}.` };
  }
  return {
    title,
    status: "problem",
    detail: `Lintel can't save files in ${folder}: ${problem}`,
    fix: "Make sure the folder exists and the user running Lintel may write to it, and that the disk isn't full.",
  };
}

export type PortProbe = "free" | "lintel" | "taken";

export function checkPort(
  what: string,
  port: number,
  probe: PortProbe,
  setting: string,
): CheckResult {
  const title = `Port ${port} (${what})`;
  if (probe === "free") {
    return { title, status: "ok", detail: "Free for Lintel to use." };
  }
  if (probe === "lintel") {
    return { title, status: "ok", detail: "Lintel is already running here." };
  }
  return {
    title,
    status: "warning",
    detail: `Something else is using port ${port}. If it isn't Lintel, Lintel won't be able to start there.`,
    fix: `Stop the other program, or set ${setting} to use another port.`,
  };
}
