import { describe, expect, it } from "vitest";
import { isValidCron, matchesCron } from "./cron.js";

describe("cron schedules", () => {
  it("match the minutes they describe, in UTC", () => {
    const mondayNine = new Date("2026-11-02T09:00:30Z");
    expect(matchesCron("0 9 * * 1", mondayNine)).toBe(true);
    expect(matchesCron("0 9 * * 2", mondayNine)).toBe(false);
    expect(matchesCron("*/15 * * * *", new Date("2026-11-02T10:45:00Z"))).toBe(true);
    expect(matchesCron("*/15 * * * *", new Date("2026-11-02T10:46:00Z"))).toBe(false);
    expect(matchesCron("0 8-17 * * 1-5", new Date("2026-11-07T12:00:00Z"))).toBe(false);
    expect(matchesCron("0 0 1 * 7", new Date("2026-11-01T00:00:00Z"))).toBe(true);
  });

  it("refuse what isn't a schedule", () => {
    expect(isValidCron("0 9 * * 1")).toBe(true);
    expect(isValidCron("0 9 * *")).toBe(false);
    expect(isValidCron("61 * * * *")).toBe(false);
    expect(isValidCron("every day")).toBe(false);
    expect(isValidCron("*/0 * * * *")).toBe(false);
  });
});
