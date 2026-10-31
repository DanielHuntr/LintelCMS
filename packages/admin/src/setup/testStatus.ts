import type { SetupStatus } from "./setup.api.js";

/** A brand new Lintel on the same computer: the starting point the setup tests vary. */
export function setupStatus(changes: Partial<SetupStatus> = {}): SetupStatus {
  return {
    needsSetup: true,
    database: { kind: "built-in", chosenBy: "default" },
    requiresSetupCode: false,
    siteSetupCompleted: false,
    ...changes,
  };
}
