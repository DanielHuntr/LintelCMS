import { describe, expect, it } from "vitest";
import { dateFromInput, dateInputValue } from "./dateValues.js";
import {
  emptyRichTextDocument,
  linkFromInputs,
  numberFromInput,
  richTextValue,
  selectedValues,
  toggleChoice,
} from "./fieldValues.js";

describe("reading stored values", () => {
  it("reads a select's value as a list, whether it holds one choice or several", () => {
    expect(selectedValues("news")).toEqual(["news"]);
    expect(selectedValues(["news", 3, "guides"])).toEqual(["news", "guides"]);
    expect(selectedValues(null)).toEqual([]);
  });

  it("reads anything that isn't a TipTap document as an empty one", () => {
    const document = { type: "doc", content: [{ type: "paragraph" }] };

    expect(richTextValue(document)).toBe(document);
    expect(richTextValue("<p>old html</p>")).toEqual(emptyRichTextDocument);
  });
});

describe("turning input into stored values", () => {
  it("treats a blank number as empty rather than zero", () => {
    expect(numberFromInput("")).toBeNull();
    expect(numberFromInput("0")).toBe(0);
    expect(numberFromInput("-2.5")).toBe(-2.5);
  });

  it("keeps a link's label only when it has one", () => {
    expect(linkFromInputs(" https://a.example ", "")).toEqual({ url: "https://a.example" });
    expect(linkFromInputs("", "Read more")).toBeNull();
  });

  it("toggles a choice while keeping the list's order", () => {
    const choices = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" },
    ];

    expect(toggleChoice(choices, ["c"], "a")).toEqual(["a", "c"]);
    expect(toggleChoice(choices, ["a", "c"], "c")).toEqual(["a"]);
  });

  it("round-trips a datetime through the browser's local time input", () => {
    const stored = new Date("2026-11-01T09:30").toISOString();

    expect(dateInputValue(stored, true)).toBe("2026-11-01T09:30");
    expect(dateFromInput(dateInputValue(stored, true), true)).toBe(stored);
  });

  it("shows a plain date in a date-and-time input as local midnight", () => {
    expect(dateInputValue("2026-11-01", true)).toBe("2026-11-01T00:00");
    expect(dateInputValue("2026-11-01T10:00:00.000Z", false)).toBe("2026-11-01");
  });
});
