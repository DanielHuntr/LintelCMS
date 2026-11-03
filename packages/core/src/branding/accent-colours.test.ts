import { describe, expect, it } from "vitest";
import {
  accentShades,
  contrastRatio,
  LINTEL_ACCENT_COLOUR,
  MINIMUM_TEXT_CONTRAST,
  normaliseHexColour,
} from "./accent-colours.js";

describe("accent shades", () => {
  it("keeps Lintel ink's hand-tuned shades, all readable", () => {
    const lintel = accentShades(LINTEL_ACCENT_COLOUR);
    expect(lintel).toMatchObject({
      fill: "#1f1d1a",
      text: "#1f1d1a",
      textDark: "#f3efe8",
      onFill: "#fffefb",
    });
    expect(contrastRatio(lintel.onFill, lintel.fill)).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(contrastRatio(lintel.text, "#f5f5f7")).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(contrastRatio(lintel.textDark, "#2c2c2e")).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });

  it("deepens a light colour for links and puts dark text on its buttons", () => {
    const yellow = accentShades("#FFD60A");
    expect(yellow.onFill).toBe("#1d1d1f");
    expect(yellow.fillIsReadable).toBe(true);
    expect(contrastRatio(yellow.text, "#f5f5f7")).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    expect(contrastRatio(yellow.textDark, "#2c2c2e")).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });

  it("lightens a dark colour for dark mode and keeps white on its buttons", () => {
    const navy = accentShades("#0b1f4d");
    expect(navy.onFill).toBe("#ffffff");
    expect(navy.text).toBe("#0b1f4d");
    expect(contrastRatio(navy.textDark, "#2c2c2e")).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });

  it("warns about a colour neither white nor black text reads well on", () => {
    const shades = accentShades("#808080");
    expect(shades.fillContrast).toBeLessThan(MINIMUM_TEXT_CONTRAST);
    expect(shades.fillIsReadable).toBe(false);
  });

  it("tidies how colours are written", () => {
    expect(normaliseHexColour("7539FD")).toBe("#7539fd");
    expect(normaliseHexColour("#abc")).toBe("#aabbcc");
    expect(normaliseHexColour("violet")).toBeNull();
  });
});
