import { describe, expect, it } from "vitest";
import { fitPicture, readObjectPosition } from "./picture-fit.js";
import { contrastRatio, mixRgb, scrimFor, strongestScrim, type Rgb } from "./readable.js";

const white: Rgb = [1, 1, 1];
const black: Rgb = [0, 0, 0];
const sand: Rgb = [0.91, 0.84, 0.75];
const slate: Rgb = [0.09, 0.2, 0.23];

describe("keeping words readable over a moving background", () => {
  it("measures contrast the way the guidelines do", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
    expect(contrastRatio(sand, sand)).toBeCloseTo(1, 5);
  });

  it("adds no veil when the words already read", () => {
    expect(scrimFor([sand, white], [[0.11, 0.11, 0.12]]).amount).toBe(0);
    expect(scrimFor([slate], [[0.96, 0.96, 0.94]]).amount).toBe(0);
  });

  it("adds no veil without words, or without colours", () => {
    expect(scrimFor([sand], []).amount).toBe(0);
    expect(scrimFor([], [white]).amount).toBe(0);
  });

  it("lays a dark veil under light words, just strong enough", () => {
    const scrim = scrimFor([sand, white], [white]);
    expect(scrim.colour).toEqual(black);
    expect(scrim.amount).toBeGreaterThan(0);
    expect(scrim.amount).toBeLessThanOrEqual(strongestScrim);
    for (const shade of [sand, white]) {
      expect(contrastRatio(mixRgb(shade, black, scrim.amount), white)).toBeGreaterThanOrEqual(4.5);
    }
    // A little less would not have been enough.
    expect(contrastRatio(mixRgb(white, black, scrim.amount - 0.05), white)).toBeLessThan(4.5);
  });

  it("lays a light veil under dark words on a dark background", () => {
    const scrim = scrimFor([slate], [[0.2, 0.2, 0.2]]);
    expect(scrim.colour).toEqual(white);
    expect(scrim.amount).toBeGreaterThan(0);
  });

  it("checks words of the first one's kind together, leaving a stray button's alone", () => {
    const dark: Rgb = [0.1, 0.1, 0.1];
    expect(scrimFor([sand], [dark, white]).amount).toBe(0);
  });

  it("never hides the background entirely", () => {
    expect(scrimFor([[0.5, 0.5, 0.5]], [[0.52, 0.5, 0.5]]).amount).toBe(strongestScrim);
  });
});

describe("lining an effect up with its picture", () => {
  it("stretches with fill", () => {
    const fitted = fitPicture({ width: 400, height: 200 }, { width: 100, height: 100 });
    expect(fitted.source).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    expect(fitted.target).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("crops the middle with cover, and follows object-position", () => {
    const middle = fitPicture({ width: 400, height: 200 }, { width: 100, height: 100 }, "cover");
    expect(middle.source).toEqual({ x: 100, y: 0, width: 200, height: 200 });
    const left = fitPicture(
      { width: 400, height: 200 },
      { width: 100, height: 100 },
      "cover",
      [0, 0.5],
    );
    expect(left.source.x).toBe(0);
  });

  it("letterboxes with contain", () => {
    const fitted = fitPicture({ width: 400, height: 200 }, { width: 100, height: 100 }, "contain");
    expect(fitted.target).toEqual({ x: 0, y: 25, width: 100, height: 50 });
  });

  it("reads object-position in words and percentages", () => {
    expect(readObjectPosition("50% 50%")).toEqual([0.5, 0.5]);
    expect(readObjectPosition("left top")).toEqual([0, 0]);
    expect(readObjectPosition("30% 80%")).toEqual([0.3, 0.8]);
    expect(readObjectPosition("12px 4px")).toEqual([0.5, 0.5]);
  });
});
