import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime.js";

const now = new Date("2026-11-01T12:00:00Z").getTime();
const before = (seconds: number) => new Date(now - seconds * 1000).toISOString();

describe("formatRelativeTime", () => {
  it("says how long ago, in the largest unit that fits", () => {
    expect(formatRelativeTime(before(20), now)).toBe("now");
    expect(formatRelativeTime(before(5 * 60), now)).toBe("5 minutes ago");
    expect(formatRelativeTime(before(2 * 60 * 60), now)).toBe("2 hours ago");
    expect(formatRelativeTime(before(26 * 60 * 60), now)).toBe("yesterday");
    expect(formatRelativeTime(before(15 * 24 * 60 * 60), now)).toBe("2 weeks ago");
  });

  it("speaks of the future too, for scheduled entries", () => {
    expect(formatRelativeTime(new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(), now)).toBe(
      "in 3 days",
    );
  });
});
