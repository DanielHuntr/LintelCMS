import { describe, expect, it } from "vitest";
import {
  checkDatabase,
  checkFolder,
  checkMigrations,
  checkNode,
  checkPnpm,
  checkPort,
  checkSettings,
} from "./doctor-checks.js";

describe("lintel doctor's checks", () => {
  it("wants Node.js 22 or newer", () => {
    expect(checkNode("v22.12.0")).toMatchObject({ status: "ok", detail: "Version 22.12.0." });
    expect(checkNode("v20.11.1")).toMatchObject({
      status: "problem",
      fix: expect.stringContaining("Node.js 22"),
    });
  });

  it("wants pnpm 10, and says how to get it", () => {
    expect(checkPnpm("10.28.0").status).toBe("ok");
    expect(checkPnpm("9.15.0").status).toBe("warning");
    expect(checkPnpm(null)).toMatchObject({
      status: "problem",
      fix: expect.stringContaining("corepack enable"),
    });
  });

  it("passes on a settings problem in the settings' own words", () => {
    expect(checkSettings({ ok: true }).status).toBe("ok");
    expect(checkSettings({ ok: false, message: "API_PORT: expected a number" })).toMatchObject({
      status: "problem",
      detail: "API_PORT: expected a number",
    });
  });

  it("treats a built-in database open in a running Lintel as fine", () => {
    expect(checkDatabase({ reachable: false, inUse: true, message: "" }).status).toBe("warning");
    expect(
      checkDatabase({ reachable: false, inUse: false, message: "Wrong password" }),
    ).toMatchObject({
      status: "problem",
      detail: "Wrong password",
    });
  });

  it("says whether the tables are up to date, behind or from a newer Lintel", () => {
    const reachable = (appliedMigrations: number) =>
      ({ reachable: true, description: "the built-in database", appliedMigrations }) as const;
    expect(checkMigrations(reachable(9), 9)?.status).toBe("ok");
    expect(checkMigrations(reachable(0), 9)).toMatchObject({
      status: "warning",
      fix: expect.stringContaining("pnpm lintel migrate"),
    });
    expect(checkMigrations(reachable(10), 9)?.status).toBe("problem");
    expect(checkMigrations({ reachable: false, inUse: true, message: "" }, 9)).toBeNull();
  });

  it("checks folders can be written to", () => {
    expect(checkFolder("Media folder", "/srv/uploads", null).status).toBe("ok");
    expect(checkFolder("Media folder", "/srv/uploads", "EACCES: permission denied")).toMatchObject({
      status: "problem",
      detail: expect.stringContaining("permission denied"),
    });
  });

  it("knows a port Lintel already uses from one something else uses", () => {
    expect(checkPort("the API", 4000, "free", "API_PORT").status).toBe("ok");
    expect(checkPort("the API", 4000, "lintel", "API_PORT").detail).toBe(
      "Lintel is already running here.",
    );
    expect(checkPort("the API", 4000, "taken", "API_PORT")).toMatchObject({
      status: "warning",
      fix: expect.stringContaining("API_PORT"),
    });
  });
});
