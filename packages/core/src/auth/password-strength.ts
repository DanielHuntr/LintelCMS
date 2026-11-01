import { ZxcvbnFactory, type MatchExtended, type ZxcvbnResult } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary as commonDictionary } from "@zxcvbn-ts/language-common";
import { dictionary as englishDictionary } from "@zxcvbn-ts/language-en";

/**
 * How easy a new password would be to guess, using zxcvbn (dictionaries of common passwords,
 * words and names, keyboard patterns, dates). The API and the admin both use this file, so the
 * meter on the setup screen and the server's answer can never disagree.
 *
 * The result is plain data (a level and a tip id), not text: the admin words it through
 * `t()` and the API through auth.errors.ts.
 */

/** Shorter than this is never accepted, however unusual. */
export const MINIMUM_PASSWORD_LENGTH = 12;

export type PasswordStrengthLevel = "too-weak" | "weak" | "good" | "strong";

/** The one piece of advice shown under the meter. */
export type PasswordTip =
  | "avoid-personal-details"
  | "avoid-common-passwords"
  | "avoid-keyboard-patterns"
  | "avoid-repeats"
  | "avoid-sequences"
  | "avoid-dates"
  | "use-more-characters"
  | "add-another-word";

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  /** How many of the meter's four segments to fill, 1 to 4. */
  filledSegments: 1 | 2 | 3 | 4;
  /** Left out once the password is good enough. */
  tip: PasswordTip | undefined;
  /** Long enough and at least "good": the rule for every new password. */
  isStrongEnough: boolean;
}

const segmentsForLevel: Record<PasswordStrengthLevel, PasswordStrength["filledSegments"]> = {
  "too-weak": 1,
  weak: 2,
  good: 3,
  strong: 4,
};

let zxcvbn: ZxcvbnFactory | undefined;

/** Built on first use: reading the dictionaries takes a moment, and most requests never need it. */
function passwordChecker(): ZxcvbnFactory {
  zxcvbn ??= new ZxcvbnFactory({
    dictionary: { ...commonDictionary, ...englishDictionary },
    graphs: adjacencyGraphs,
  });
  return zxcvbn;
}

/**
 * Checks a new password. `personalDetails` are the person's own name and email, which make a
 * password easy to guess for anyone who knows them; see `personalDetailsFrom`.
 */
export function checkPasswordStrength(
  password: string,
  personalDetails: readonly string[] = [],
): PasswordStrength {
  const result = passwordChecker().check(password, [...personalDetails]);
  const level = levelFor(result.score, password.length);
  const isStrongEnough = level === "good" || level === "strong";

  return {
    level,
    filledSegments: segmentsForLevel[level],
    tip: isStrongEnough ? undefined : tipFor(result, password.length),
    isStrongEnough,
  };
}

/**
 * zxcvbn scores 0 to 4. The meter has four steps, so 0 and 1 share "too weak". A password
 * under the minimum length is never shown as good, so the meter and the rule agree.
 */
export function levelFor(score: ZxcvbnResult["score"], length: number): PasswordStrengthLevel {
  const level: PasswordStrengthLevel =
    score >= 4 ? "strong" : score === 3 ? "good" : score === 2 ? "weak" : "too-weak";
  if (length < MINIMUM_PASSWORD_LENGTH && (level === "good" || level === "strong")) {
    return "weak";
  }
  return level;
}

/**
 * The most useful advice first. Someone's own name is worth hearing about straight away; while
 * the password is still short, "keep going" is more helpful than commenting on half a word.
 */
function tipFor(result: Pick<ZxcvbnResult, "sequence">, length: number): PasswordTip {
  const matches = result.sequence;
  if (matches.some((match) => isDictionaryMatch(match, "userInputs"))) {
    return "avoid-personal-details";
  }
  if (length < MINIMUM_PASSWORD_LENGTH) return "use-more-characters";
  if (matches.some((match) => isDictionaryMatch(match, "passwords"))) {
    return "avoid-common-passwords";
  }
  const patternTip = patternTips.find(({ pattern }) => matches.some((match) => pattern(match)));
  return patternTip?.tip ?? "add-another-word";
}

const patternTips: readonly { pattern: (match: MatchExtended) => boolean; tip: PasswordTip }[] = [
  { pattern: (match) => match.pattern === "spatial", tip: "avoid-keyboard-patterns" },
  { pattern: (match) => match.pattern === "repeat", tip: "avoid-repeats" },
  { pattern: (match) => match.pattern === "sequence", tip: "avoid-sequences" },
  {
    pattern: (match) =>
      match.pattern === "date" || (match.pattern === "regex" && match.regexName === "recentYear"),
    tip: "avoid-dates",
  },
];

/** zxcvbn names dictionaries "passwords-common", "commonWords-en" and so on. */
function isDictionaryMatch(match: MatchExtended, dictionaryName: string): boolean {
  if (match.pattern !== "dictionary") return false;
  const name: unknown = match.dictionaryName;
  return (
    typeof name === "string" && (name === dictionaryName || name.startsWith(`${dictionaryName}-`))
  );
}

/**
 * The words in someone's name and email worth keeping out of their password: "Ana Lopez",
 * "ana.lopez@example.com" gives the full name (with and without spaces), each name, the email,
 * its parts and the domain.
 */
export function personalDetailsFrom(name: string, email: string): string[] {
  const trimmedEmail = email.trim().toLowerCase();
  const [localPart = "", domain = ""] = trimmedEmail.split("@");
  const pieces = [
    name.trim(),
    // People often run their name together: "analopez".
    name.replace(/\s+/g, ""),
    ...name.trim().split(/\s+/),
    trimmedEmail,
    localPart,
    ...localPart.split(/[._+-]+/),
    domain.split(".")[0] ?? "",
  ];
  // Very short pieces ("a", "li") match inside ordinary words and would only add noise.
  return [...new Set(pieces.map((piece) => piece.toLowerCase()))].filter(
    (piece) => piece.length >= 3,
  );
}
