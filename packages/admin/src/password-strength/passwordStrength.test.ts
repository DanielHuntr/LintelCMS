import { describe, expect, it } from "vitest";
import {
  loadPasswordStrength,
  strengthAnnouncement,
  strengthLabel,
  tipText,
} from "./passwordStrength.js";

describe("the strength meter's words", () => {
  it("names the four levels in plain English", () => {
    expect(
      (["too-weak", "weak", "good", "strong"] as const).map((level) => strengthLabel(level)),
    ).toEqual(["Too weak", "Weak", "Good", "Strong"]);
  });

  it("reads the level and the tip together", () => {
    expect(
      strengthAnnouncement({
        level: "weak",
        filledSegments: 2,
        tip: "add-another-word",
        isStrongEnough: false,
      }),
    ).toBe("Password strength: Weak. Add another word or two.");
    expect(tipText("avoid-personal-details")).toBe("Avoid your name or email.");
  });
});

describe("loadPasswordStrength", () => {
  it("loads the API's own checker once and shares it", async () => {
    const [first, second] = await Promise.all([loadPasswordStrength(), loadPasswordStrength()]);

    expect(first).toBe(second);
    expect(first.MINIMUM_PASSWORD_LENGTH).toBe(12);
    expect(first.checkPasswordStrength("password1234", []).level).toBe("too-weak");
  });
});
