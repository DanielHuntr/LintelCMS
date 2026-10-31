import { describe, expect, it } from "vitest";
import {
  accountScreensFor,
  destinationOnceSetUp,
  mustChooseSiteFirst,
  mustFinishSetupFirst,
  setupProgress,
} from "./setupRouting.js";
import { setupStatus } from "./testStatus.js";

describe("mustFinishSetupFirst", () => {
  it("sends every address to /setup while there is no account, sign-in included", () => {
    expect(mustFinishSetupFirst("/", true)).toBe(true);
    expect(mustFinishSetupFirst("/sign-in", true)).toBe(true);
    expect(mustFinishSetupFirst("/content", true)).toBe(true);
    expect(mustFinishSetupFirst("/setup/site", true)).toBe(true);
  });

  it("lets /setup itself load", () => {
    expect(mustFinishSetupFirst("/setup", true)).toBe(false);
  });

  it("stays out of the way once the account exists", () => {
    expect(mustFinishSetupFirst("/sign-in", false)).toBe(false);
    expect(mustFinishSetupFirst("/", false)).toBe(false);
  });
});

describe("destinationOnceSetUp", () => {
  it("sends people who aren't signed in to sign in", () => {
    expect(destinationOnceSetUp(false, true)).toBe("/sign-in");
    expect(destinationOnceSetUp(false, false)).toBe("/sign-in");
  });

  it("sends signed-in people to the dashboard, or back to finish choosing their site", () => {
    expect(destinationOnceSetUp(true, true)).toBe("/");
    expect(destinationOnceSetUp(true, false)).toBe("/setup/site");
  });
});

describe("mustChooseSiteFirst", () => {
  it("brings back someone who closed the tab after creating their account", () => {
    expect(mustChooseSiteFirst(setupStatus({ needsSetup: false }))).toBe(true);
  });

  it("does nothing before the account exists or after the site is chosen", () => {
    expect(mustChooseSiteFirst(setupStatus({ needsSetup: true }))).toBe(false);
    expect(mustChooseSiteFirst(setupStatus({ needsSetup: false, siteSetupCompleted: true }))).toBe(
      false,
    );
  });
});

describe("accountScreensFor", () => {
  it("welcomes, asks about the database, then builds the account one question at a time", () => {
    expect(accountScreensFor(setupStatus(), "built-in")).toEqual([
      "welcome",
      "database",
      "name",
      "email",
      "password",
    ]);
  });

  it("asks for the PostgreSQL details only once PostgreSQL is chosen", () => {
    expect(accountScreensFor(setupStatus(), "postgres")).toEqual([
      "welcome",
      "database",
      "postgres",
      "name",
      "email",
      "password",
    ]);
  });

  it("skips both database screens when DATABASE_URL has already chosen", () => {
    const status = setupStatus({ database: { kind: "postgres", chosenBy: "environment" } });
    expect(accountScreensFor(status, "postgres")).toEqual(["welcome", "name", "email", "password"]);
  });

  it("asks for the setup code straight after the welcome when setting up from elsewhere", () => {
    expect(accountScreensFor(setupStatus({ requiresSetupCode: true }), "built-in")).toEqual([
      "welcome",
      "setup-code",
      "database",
      "name",
      "email",
      "password",
    ]);
  });
});

describe("setupProgress", () => {
  it("runs from 0 at the welcome to 1 when done, across both halves of setup", () => {
    const status = setupStatus();
    // welcome, database, name, email, password, site-type, features, done
    expect(setupProgress("welcome", status, "built-in")).toBe(0);
    expect(setupProgress("name", status, "built-in")).toBeCloseTo(2 / 7);
    expect(setupProgress("site-type", status, "built-in")).toBeCloseTo(5 / 7);
    expect(setupProgress("done", status, "built-in")).toBe(1);
  });

  it("makes room for the PostgreSQL screen when it is part of the flow", () => {
    expect(setupProgress("postgres", setupStatus(), "postgres")).toBeCloseTo(2 / 8);
  });
});
