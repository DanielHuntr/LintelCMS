import { describe, expect, it } from "vitest";
import {
  effWordList,
  generatePassphrase,
  passphraseWordCount,
  randomIndexBelow,
  type RandomSource,
} from "./passphrase.js";

/** Hands out the given numbers in turn, as a stand-in for crypto. */
function fixedRandom(values: number[]): RandomSource & { draws: number } {
  const source = {
    draws: 0,
    getRandomValues(target: Uint32Array<ArrayBuffer>) {
      target[0] = values[source.draws % values.length] ?? 0;
      source.draws += 1;
      return target;
    },
  };
  return source;
}

describe("the word list", () => {
  it("has 7,772 distinct lowercase words, none with a hyphen", () => {
    expect(effWordList).toHaveLength(7772);
    expect(new Set(effWordList).size).toBe(7772);
    expect(effWordList.every((word) => /^[a-z]+$/.test(word))).toBe(true);
  });
});

describe("generatePassphrase", () => {
  it("is four words and a two-digit number, joined with hyphens", () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const passphrase = generatePassphrase();
      const parts = passphrase.split("-");

      expect(parts).toHaveLength(passphraseWordCount + 1);
      expect(parts.slice(0, 4).every((word) => effWordList.includes(word))).toBe(true);
      expect(Number(parts[4])).toBeGreaterThanOrEqual(10);
      expect(Number(parts[4])).toBeLessThanOrEqual(99);
      expect(passphrase).toMatch(/^[a-z-]+-\d{2}$/);
    }
  });

  it("is different each time", () => {
    const passphrases = new Set(Array.from({ length: 200 }, () => generatePassphrase()));
    expect(passphrases.size).toBe(200);
  });

  it("uses the random source it is given", () => {
    expect(generatePassphrase(["apple", "pear", "plum"], fixedRandom([0, 1, 2, 0, 5]))).toBe(
      "apple-pear-plum-apple-15",
    );
  });
});

describe("randomIndexBelow", () => {
  it("throws away draws from the uneven top of the range instead of wrapping them", () => {
    // 2^32 is 1 more than a multiple of 3, so the very top value would favour 0.
    const random = fixedRandom([2 ** 32 - 1, 7]);

    expect(randomIndexBelow(3, random)).toBe(1);
    expect(random.draws).toBe(2);
  });

  it("keeps every value of a range that divides 2^32 evenly", () => {
    const random = fixedRandom([2 ** 32 - 1]);

    expect(randomIndexBelow(4, random)).toBe(3);
    expect(random.draws).toBe(1);
  });

  it("refuses limits it can't serve fairly", () => {
    expect(() => randomIndexBelow(0)).toThrow(RangeError);
    expect(() => randomIndexBelow(1.5)).toThrow(RangeError);
  });

  it("spreads results evenly (a rough check, not a proof)", () => {
    const counts = new Array<number>(10).fill(0);
    const draws = 50_000;
    for (let draw = 0; draw < draws; draw++) {
      const index = randomIndexBelow(10);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    // Each bucket expects 5,000; ±10% is many standard deviations of slack.
    for (const count of counts) {
      expect(count).toBeGreaterThan(4500);
      expect(count).toBeLessThan(5500);
    }
  });
});
