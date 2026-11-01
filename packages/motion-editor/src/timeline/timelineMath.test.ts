import { describe, expect, it } from "vitest";
import { formatSeconds, tickStep, ticks } from "./timelineMath.js";

describe("the time ruler", () => {
  it("labels ticks far enough apart to read", () => {
    expect(tickStep(560 / 600)).toBe(100);
    expect(tickStep(560 / 6000)).toBe(1000);
    expect(tickStep(4 * (560 / 600))).toBe(20);
    expect(ticks(600, 200)).toEqual([0, 200, 400, 600]);
  });

  it("shows seconds plainly", () => {
    expect(formatSeconds(0)).toBe("0 s");
    expect(formatSeconds(350)).toBe("0.35 s");
    expect(formatSeconds(1200)).toBe("1.2 s");
    expect(formatSeconds(12_500)).toBe("12.5 s");
  });
});
