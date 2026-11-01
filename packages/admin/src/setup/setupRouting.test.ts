import { describe, expect, it } from "vitest";
import {
  destinationOnceSetUp,
  mustFinishSetupFirst,
  setupScreensFor,
  setupStepsFor,
  stepOfScreen,
} from "./setupRouting.js";
import { setupStatus } from "./testStatus.js";

describe("mustFinishSetupFirst", () => {
  it("sends every address to /setup while setup isn't finished, sign-in included", () => {
    expect(mustFinishSetupFirst("/", true)).toBe(true);
    expect(mustFinishSetupFirst("/sign-in", true)).toBe(true);
    expect(mustFinishSetupFirst("/content", true)).toBe(true);
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
  it("sends people to sign in, or to the dashboard when they already are", () => {
    expect(destinationOnceSetUp(false)).toBe("/sign-in");
    expect(destinationOnceSetUp(true)).toBe("/");
  });
});

describe("setupStepsFor", () => {
  it("has five steps, ending with the review", () => {
    expect(setupStepsFor(setupStatus())).toEqual([
      "database",
      "account",
      "site-name",
      "site-type",
      "review",
    ]);
  });

  it("leaves out the database step when DATABASE_URL has already chosen", () => {
    const status = setupStatus({ database: { kind: "postgres", chosenBy: "environment" } });
    expect(setupStepsFor(status)).toEqual(["account", "site-name", "site-type", "review"]);
  });
});

describe("setupScreensFor", () => {
  it("welcomes, then goes through every step", () => {
    expect(setupScreensFor(setupStatus(), "built-in")).toEqual([
      "welcome",
      "database",
      "account",
      "site-name",
      "site-type",
      "review",
      "done",
    ]);
  });

  it("asks for the PostgreSQL details within the database step once PostgreSQL is chosen", () => {
    expect(setupScreensFor(setupStatus(), "postgres").slice(0, 4)).toEqual([
      "welcome",
      "database",
      "postgres",
      "account",
    ]);
    expect(stepOfScreen("postgres")).toBe("database");
  });

  it("asks for the setup code straight after the welcome when setting up from elsewhere", () => {
    expect(setupScreensFor(setupStatus({ requiresSetupCode: true }), "built-in")[1]).toBe(
      "setup-code",
    );
    expect(stepOfScreen("setup-code")).toBeUndefined();
  });
});
