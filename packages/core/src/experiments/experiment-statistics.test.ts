import { describe, expect, it } from "vitest";
import {
  compareWithOriginal,
  hasEnoughData,
  logGamma,
  probabilityBIsBetter,
} from "./experiment-statistics.js";

describe("how sure a test result is", () => {
  it("works out log-gamma accurately", () => {
    expect(logGamma(1)).toBeCloseTo(0, 10);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
  });

  it("calls two identical versions a coin toss", () => {
    const counts = { visitors: 1000, conversions: 100 };
    expect(probabilityBIsBetter(counts, counts)).toBeCloseTo(0.5, 2);
  });

  it("agrees with the normal approximation for a clear difference", () => {
    // 10% against 13% on 1,000 visitors each: z ≈ 2.1, so about 98% sure.
    const probability = probabilityBIsBetter(
      { visitors: 1000, conversions: 100 },
      { visitors: 1000, conversions: 130 },
    );
    expect(probability).toBeGreaterThan(0.97);
    expect(probability).toBeLessThan(0.99);
  });

  it("is symmetric: B better and the original better add up to one", () => {
    const a = { visitors: 400, conversions: 31 };
    const b = { visitors: 380, conversions: 40 };
    expect(probabilityBIsBetter(a, b) + probabilityBIsBetter(b, a)).toBeCloseTo(1, 6);
  });

  it("stays close to the exact answer for very large tests", () => {
    const probability = probabilityBIsBetter(
      { visitors: 200_000, conversions: 10_000 },
      { visitors: 200_000, conversions: 10_400 },
    );
    expect(probability).toBeGreaterThan(0.99);
    expect(probability).toBeLessThanOrEqual(1);
  });

  it("calls a strong lead on enough visitors better, about how sure it is", () => {
    const original = { visitors: 1000, conversions: 100 };
    const b = { visitors: 1000, conversions: 130 };
    const comparison = compareWithOriginal(original, b, hasEnoughData([original, b]));
    expect(comparison.verdict).toBe("better");
    expect(comparison.sureness).toBeGreaterThanOrEqual(97);
    expect(comparison.relativeDifference).toBeCloseTo(0.3, 5);
    expect(comparison.rate).toBeCloseTo(0.13, 5);
  });

  it("calls no successes on either side about the same (LINTEL-UX-331)", () => {
    const original = { visitors: 17, conversions: 0 };
    const b = { visitors: 7, conversions: 0 };
    expect(compareWithOriginal(original, b, false).verdict).toBe("tooClose");
  });

  it("says it's too early when the lead is real-looking but the sample small", () => {
    const original = { visitors: 40, conversions: 2 };
    const b = { visitors: 40, conversions: 8 };
    expect(hasEnoughData([original, b])).toBe(false);
    expect(compareWithOriginal(original, b, false).verdict).toBe("aheadTooEarly");
    expect(compareWithOriginal(b, original, false).verdict).toBe("behindTooEarly");
  });

  it("calls a clearly worse version worse", () => {
    const original = { visitors: 2000, conversions: 260 };
    const b = { visitors: 2000, conversions: 180 };
    const comparison = compareWithOriginal(original, b, hasEnoughData([original, b]));
    expect(comparison.verdict).toBe("worse");
    expect(comparison.sureness).toBeGreaterThanOrEqual(95);
  });

  it("says too close to call when nothing separates them", () => {
    const original = { visitors: 500, conversions: 50 };
    const b = { visitors: 500, conversions: 51 };
    expect(compareWithOriginal(original, b, true).verdict).toBe("tooClose");
  });

  it("has nothing to say before anyone visits", () => {
    const none = { visitors: 0, conversions: 0 };
    const comparison = compareWithOriginal(none, none, false);
    expect(comparison.verdict).toBe("noData");
    expect(comparison.relativeDifference).toBeNull();
  });

  it("needs 100 visitors on every version and 20 conversions in all", () => {
    expect(
      hasEnoughData([
        { visitors: 100, conversions: 10 },
        { visitors: 100, conversions: 10 },
      ]),
    ).toBe(true);
    expect(
      hasEnoughData([
        { visitors: 100, conversions: 10 },
        { visitors: 99, conversions: 10 },
      ]),
    ).toBe(false);
    expect(
      hasEnoughData([
        { visitors: 500, conversions: 9 },
        { visitors: 500, conversions: 10 },
      ]),
    ).toBe(false);
  });
});
