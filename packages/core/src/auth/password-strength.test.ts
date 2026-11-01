import { describe, expect, it } from "vitest";
import {
  checkPasswordStrength,
  levelFor,
  MINIMUM_PASSWORD_LENGTH,
  personalDetailsFrom,
} from "./password-strength.js";

const ANA = personalDetailsFrom("Ana Lopez", "ana.lopez@example.com");

describe("checkPasswordStrength", () => {
  it.each([
    ["password1234", "too-weak", 1],
    ["chocolatecake", "weak", 2],
    ["kettle cobalt", "good", 3],
    ["maple-orbit-cactus-river-42", "strong", 4],
  ] as const)("rates %s as %s", (password, level, filledSegments) => {
    expect(checkPasswordStrength(password, ANA)).toMatchObject({ level, filledSegments });
  });

  it("accepts good and strong passwords, with no tip", () => {
    expect(checkPasswordStrength("kettle cobalt", ANA)).toEqual({
      level: "good",
      filledSegments: 3,
      tip: undefined,
      isStrongEnough: true,
    });
  });

  it("refuses the person's own name and email", () => {
    const strength = checkPasswordStrength("analopez1990", ANA);

    expect(strength.isStrongEnough).toBe(false);
    expect(strength.tip).toBe("avoid-personal-details");
    // Without knowing who it's for, the same password looks fine.
    expect(checkPasswordStrength("analopez1990").tip).not.toBe("avoid-personal-details");
  });

  it.each([
    ["kettle", "use-more-characters"],
    ["password1234", "avoid-common-passwords"],
    ["aaaaaaaaaaaaaa", "avoid-repeats"],
    ["abcdefghijklmn", "avoid-sequences"],
    ["horsebattery", "add-another-word"],
  ] as const)("gives one tip for %s: %s", (password, tip) => {
    expect(checkPasswordStrength(password, ANA).tip).toBe(tip);
  });
});

describe("levelFor", () => {
  it("shares 'too weak' between zxcvbn's two lowest scores", () => {
    expect([0, 1, 2, 3, 4].map((score) => levelFor(score as 0, 20))).toEqual([
      "too-weak",
      "too-weak",
      "weak",
      "good",
      "strong",
    ]);
  });

  it("never calls a password under the minimum length good", () => {
    expect(levelFor(4, MINIMUM_PASSWORD_LENGTH - 1)).toBe("weak");
    expect(levelFor(4, MINIMUM_PASSWORD_LENGTH)).toBe("strong");
  });
});

describe("personalDetailsFrom", () => {
  it("takes the name, each word of it, the email and its parts", () => {
    expect(personalDetailsFrom(" Ana Lopez ", "Ana.Lopez@Example.com")).toEqual([
      "ana lopez",
      "analopez",
      "ana",
      "lopez",
      "ana.lopez@example.com",
      "ana.lopez",
      "example",
    ]);
  });

  it("leaves out pieces too short to matter", () => {
    expect(personalDetailsFrom("Li", "li@x.io")).toEqual(["li@x.io"]);
  });
});
