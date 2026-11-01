import { describe, expect, it } from "vitest";
import { detectInstallType, type InstallFacts, updateMethodFor } from "./install-type.js";

function facts(
  environment: Record<string, string>,
  files: string[] = [],
  installFolder = "/srv/lintel",
): InstallFacts {
  return { environment, installFolder, exists: (path) => files.includes(path) };
}

describe("how Lintel was installed", () => {
  it("tells each kind of install apart", () => {
    expect(detectInstallType(facts({ LINTEL_SUPERVISED: "1" }, ["/.dockerenv"]))).toBe(
      "supervised",
    );
    expect(detectInstallType(facts({ LINTEL_DOCKER: "1" }))).toBe("docker");
    expect(detectInstallType(facts({}, ["/.dockerenv"]))).toBe("docker");
    expect(detectInstallType(facts({ IN_PASSENGER: "1" }))).toBe("passenger");
    expect(detectInstallType(facts({ PASSENGER_APP_ENV: "production" }))).toBe("passenger");
    expect(
      detectInstallType(facts({}, ["/home/forge/example.com/.git"], "/home/forge/example.com")),
    ).toBe("forge");
    expect(detectInstallType(facts({}, ["/srv/lintel/.git"]))).toBe("source");
    expect(detectInstallType(facts({}))).toBe("process");
  });

  it("does as LINTEL_INSTALL_TYPE says, and ignores a value it doesn't know", () => {
    expect(detectInstallType(facts({ LINTEL_INSTALL_TYPE: "docker" }, ["/srv/lintel/.git"]))).toBe(
      "docker",
    );
    expect(detectInstallType(facts({ LINTEL_INSTALL_TYPE: "floppy" }))).toBe("process");
  });

  it("offers the button only where it can work", () => {
    const noUpdater = { dockerUpdaterAvailable: false };
    expect(updateMethodFor("supervised", noUpdater).oneClick).toBe(true);
    expect(updateMethodFor("docker", noUpdater)).toEqual({
      installType: "docker",
      oneClick: false,
      commands: [
        "git fetch --tags && git checkout v{version}",
        "docker compose -f deploy/docker-compose.yml up -d --build",
      ],
    });
    expect(updateMethodFor("docker", { dockerUpdaterAvailable: true }).oneClick).toBe(true);
    expect(updateMethodFor("source", noUpdater).commands).toEqual([
      "pnpm lintel update --to {version}",
    ]);
    for (const type of ["process", "passenger", "forge"] as const) {
      expect(updateMethodFor(type, noUpdater).oneClick, type).toBe(false);
    }
  });
});
