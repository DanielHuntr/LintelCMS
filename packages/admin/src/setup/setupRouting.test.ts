import { describe, expect, it } from "vitest";
import {
  destinationOnceSetUp,
  mustChooseSiteFirst,
  mustFinishSetupFirst,
  setupStepsFor,
  stepNumberOf,
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

describe("setupStepsFor", () => {
  it("asks about the database, the account and the site", () => {
    expect(setupStepsFor(setupStatus())).toEqual(["database", "account", "site"]);
  });

  it("skips the database step when DATABASE_URL has already chosen", () => {
    const status = setupStatus({ database: { kind: "postgres", chosenBy: "environment" } });
    expect(setupStepsFor(status)).toEqual(["account", "site"]);
  });

  it("asks for the setup code first when setting up from another computer", () => {
    expect(setupStepsFor(setupStatus({ requiresSetupCode: true }))).toEqual([
      "setup-code",
      "database",
      "account",
      "site",
    ]);
  });
});

describe("stepNumberOf", () => {
  it("numbers the steps without counting the setup code", () => {
    const status = setupStatus({ requiresSetupCode: true });
    expect(stepNumberOf("setup-code", status)).toBeUndefined();
    expect(stepNumberOf("database", status)).toEqual({ current: 1, total: 3 });
    expect(stepNumberOf("site", status)).toEqual({ current: 3, total: 3 });
  });

  it("renumbers when the database step is skipped", () => {
    const status = setupStatus({ database: { kind: "postgres", chosenBy: "environment" } });
    expect(stepNumberOf("account", status)).toEqual({ current: 1, total: 2 });
  });
});
