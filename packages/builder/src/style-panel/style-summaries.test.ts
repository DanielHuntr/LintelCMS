import type { StylePropertyName } from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { englishText } from "../i18n/builder-text.js";
import {
  backgroundSummary,
  bordersSummary,
  effectsSummary,
  friendlyLength,
  layoutSummary,
  positionSummary,
  shadows,
  sizeSummary,
  spacingSummary,
  textSummary,
} from "./style-summaries.js";

function reading(values: Partial<Record<StylePropertyName, string>>) {
  return (property: StylePropertyName) => values[property];
}

describe("what a closed style group says", () => {
  it("names the arrangement and the space between, with the theme's sizes", () => {
    expect(
      layoutSummary(
        reading({ display: "flex", flexDirection: "row", gap: "var(--lintel-space-4)" }),
        englishText,
      ),
    ).toBe("Side by side · gap M");
    expect(
      layoutSummary(
        reading({ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }),
        englishText,
      ),
    ).toBe("On a grid · 3 columns");
    expect(layoutSummary(reading({}), englishText)).toBe("");
  });

  it("says the space inside and outside", () => {
    expect(
      spacingSummary(
        reading({ paddingTop: "var(--lintel-space-5)", marginBottom: "24px" }),
        englishText,
      ),
    ).toBe("Inside L · outside 24px");
    expect(spacingSummary(reading({ paddingTop: "0" }), englishText)).toBe("");
  });

  it("describes text, size, background, corners, position and effects in plain words", () => {
    expect(
      textSummary(
        reading({ fontSize: "2rem", fontWeight: "700", textAlign: "center" }),
        englishText,
      ),
    ).toBe("Huge · Bold · Centre");
    expect(sizeSummary(reading({ width: "50%", maxWidth: "40rem" }), englishText)).toBe(
      "Width 50% · widest 40rem",
    );
    expect(backgroundSummary(reading({ backgroundColor: "var(--lintel-color-brand)" }))).toBe(
      "Brand",
    );
    expect(
      bordersSummary(reading({ borderRadius: "999px", borderWidth: "2px" }), englishText),
    ).toBe("Round corners · 2px border");
    expect(positionSummary(reading({ position: "sticky" }), englishText)).toBe(
      "Sticks while scrolling",
    );
    expect(effectsSummary(reading({ opacity: "0.75", boxShadow: shadows.soft }), englishText)).toBe(
      "25% see-through · soft shadow",
    );
  });

  it("gives lengths in pixels, as people know them", () => {
    expect(friendlyLength("1.125rem")).toBe("18px");
    expect(friendlyLength("0.75em")).toBe("12px");
    expect(friendlyLength("24px")).toBe("24px");
    expect(friendlyLength("clamp(1rem, 2vw, 2rem)")).toBeUndefined();
    expect(textSummary(reading({ fontSize: "1.125rem" }), englishText)).toBe("18px");
  });
});
