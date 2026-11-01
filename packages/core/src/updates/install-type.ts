import { existsSync } from "node:fs";
import { join } from "node:path";
import { installTypes, type InstallType, type UpdateMethod } from "./updates.schema.js";

/**
 * How this copy of Lintel was installed decides how it is updated:
 *
 *   supervised  started with `lintel start`: the Update button does everything
 *   process     `pnpm start` without the supervisor: switch to `lintel start` for the button
 *   docker      the Docker image: two commands, or the opt-in lintel-updater service
 *   source      a git clone (usually `pnpm dev`): `lintel update`, then restart
 *   passenger   cPanel or another Passenger host: a new hosting package, then restart.txt
 *   forge       Laravel Forge running Lintel as a daemon: deploy, then restart the daemon
 *
 * LINTEL_INSTALL_TYPE overrides the guess when it is wrong.
 */
export interface InstallFacts {
  environment: Readonly<Record<string, string | undefined>>;
  /** The folder with packages/ in it: the repository, or a release folder. */
  installFolder: string;
  exists(path: string): boolean;
}

export function currentInstallFacts(installFolder: string): InstallFacts {
  return { environment: process.env, installFolder, exists: existsSync };
}

export function detectInstallType(facts: InstallFacts): InstallType {
  const { environment, installFolder, exists } = facts;
  const chosen = environment.LINTEL_INSTALL_TYPE;
  if (chosen && (installTypes as readonly string[]).includes(chosen)) {
    return chosen as InstallType;
  }
  if (environment.LINTEL_SUPERVISED === "1") {
    return "supervised";
  }
  // The Dockerfile sets LINTEL_DOCKER; /.dockerenv covers images built some other way.
  if (environment.LINTEL_DOCKER === "1" || exists("/.dockerenv")) {
    return "docker";
  }
  if (
    environment.IN_PASSENGER === "1" ||
    environment.PASSENGER_APP_ENV !== undefined ||
    environment.PASSENGER_BASE_URI !== undefined
  ) {
    return "passenger";
  }
  if (environment.FORGE_SITE_PATH !== undefined || installFolder.startsWith("/home/forge/")) {
    return "forge";
  }
  if (exists(join(installFolder, ".git"))) {
    return "source";
  }
  return "process";
}

export interface UpdateMethodOptions {
  /** The opt-in lintel-updater service is set up (Docker only). */
  dockerUpdaterAvailable: boolean;
}

/**
 * What Settings → Updates offers for this install. Commands may contain `{version}`, which
 * the admin fills in with the version chosen.
 */
export function updateMethodFor(
  installType: InstallType,
  options: UpdateMethodOptions,
): UpdateMethod {
  switch (installType) {
    case "supervised":
      return { installType, oneClick: true, commands: [] };
    case "process":
      return { installType, oneClick: false, commands: ["pnpm lintel start"] };
    case "docker":
      return {
        installType,
        oneClick: options.dockerUpdaterAvailable,
        commands: [
          "git fetch --tags && git checkout v{version}",
          "docker compose -f deploy/docker-compose.yml up -d --build",
        ],
      };
    case "source":
      return { installType, oneClick: false, commands: ["pnpm lintel update --to {version}"] };
    case "passenger":
      // The hosting package's layout comes with shared hosting support; until then this is
      // done by hand, as the hosting guide describes.
      return { installType, oneClick: false, commands: ["touch tmp/restart.txt"] };
    case "forge":
      return {
        installType,
        oneClick: false,
        commands: [
          "git fetch --tags && git checkout v{version}",
          "pnpm install --frozen-lockfile && pnpm build",
          "pnpm lintel migrate",
        ],
      };
  }
}
