import { describe, expect, it } from "vitest";
import { headingComponent } from "../components/content-components.js";
import {
  applyMark,
  clearMarks,
  markedSegments,
  planMarkDrawings,
  rebaseMarks,
  sharedMarkStyles,
  type TextMark,
} from "./text-marks.js";

const italic = { fontStyle: "italic" } as const;

describe("styling part of a text", () => {
  it("splits and joins marks as styles are applied over each other", () => {
    let marks = applyMark([], 2, 4, italic, 7);
    expect(marks).toEqual([{ from: 2, to: 4, styles: italic }]);
    marks = applyMark(marks, 3, 6, { color: "red" }, 7);
    expect(marks).toEqual([
      { from: 2, to: 3, styles: italic },
      { from: 3, to: 4, styles: { fontStyle: "italic", color: "red" } },
      { from: 4, to: 6, styles: { color: "red" } },
    ]);
    marks = applyMark(marks, 2, 6, { fontStyle: undefined }, 7);
    expect(marks).toEqual([{ from: 3, to: 6, styles: { color: "red" } }]);
    expect(clearMarks(marks, 0, 7, 7)).toEqual([]);
  });

  it("knows which styles a whole selection shares", () => {
    const marks: TextMark[] = [
      { from: 0, to: 2, styles: { fontStyle: "italic", color: "red" } },
      { from: 2, to: 4, styles: { fontStyle: "italic" } },
    ];
    expect(sharedMarkStyles(marks, 0, 4)).toEqual({ fontStyle: "italic" });
    expect(sharedMarkStyles(marks, 0, 5)).toEqual({});
  });

  it("moves marks with their words when the text is edited", () => {
    const marks: TextMark[] = [{ from: 6, to: 9, styles: italic }];
    // "Hello big world" -> "Oh, hello big world"
    expect(rebaseMarks("Hello big world", "Oh, hello big world", marks)).toEqual([
      { from: 10, to: 13, styles: italic },
    ]);
    // Typing at the end of the marked word joins the mark.
    expect(rebaseMarks("Hello big world", "Hello bigger world", marks)).toEqual([
      { from: 6, to: 12, styles: italic },
    ]);
    // Deleting the marked word removes the mark.
    expect(rebaseMarks("Hello big world", "Hello world", marks)).toEqual([]);
  });

  it("cuts the text into runs and draws italics as em, the rest as classes", () => {
    const marks: TextMark[] = [
      { from: 2, to: 4, styles: { fontStyle: "italic" } },
      { from: 5, to: 6, styles: { fontStyle: "italic", fontWeight: "300" } },
      { from: 6, to: 7, styles: { fontWeight: "300" } },
    ];
    expect(markedSegments("FREEDOM", marks).map((segment) => segment.text)).toEqual([
      "FR",
      "EE",
      "D",
      "O",
      "M",
    ]);
    expect(planMarkDrawings(marks)).toEqual([
      { tag: "em", classNumber: null, declarations: {} },
      { tag: "em", classNumber: 1, declarations: { fontWeight: "300" } },
      { tag: "span", classNumber: 1, declarations: { fontWeight: "300" } },
    ]);
  });

  it("are checked against the text when a heading is saved", () => {
    const fits = headingComponent.propsSchema.safeParse({
      text: "Bold",
      marks: [{ from: 0, to: 2, styles: italic }],
    });
    expect(fits.success).toBe(true);
    const tooLong = headingComponent.propsSchema.safeParse({
      text: "Bold",
      marks: [{ from: 0, to: 9, styles: italic }],
    });
    expect(tooLong.success).toBe(false);
    const unsafe = headingComponent.propsSchema.safeParse({
      text: "Bold",
      marks: [{ from: 0, to: 2, styles: { display: "none" } }],
    });
    expect(unsafe.success).toBe(false);
  });
});
