import type {
  PasswordStrength,
  PasswordStrengthLevel,
  PasswordTip,
} from "@lintel/core/password-strength";
import { t, type StringKey } from "../i18n/strings.js";

export type { PasswordStrength, PasswordStrengthLevel, PasswordTip };

/**
 * The admin's side of the strength check. The rule itself is the API's own file
 * (`@lintel/core/password-strength`), loaded only when a new-password field appears: its
 * dictionaries are large, and the sign-in screen and the first setup screens don't need them.
 */

export type PasswordChecker = (
  password: string,
  personalDetails: readonly string[],
) => PasswordStrength;

export interface PasswordStrengthModule {
  checkPasswordStrength: PasswordChecker;
  personalDetailsFrom: (name: string, email: string) => string[];
  MINIMUM_PASSWORD_LENGTH: number;
}

let loading: Promise<PasswordStrengthModule> | undefined;

/** Loads the checker once; later calls share the same download. A failed load can be retried. */
export function loadPasswordStrength(): Promise<PasswordStrengthModule> {
  loading ??= import("@lintel/core/password-strength").catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

const levelKeys: Record<PasswordStrengthLevel, StringKey> = {
  "too-weak": "passwordStrength.tooWeak",
  weak: "passwordStrength.weak",
  good: "passwordStrength.good",
  strong: "passwordStrength.strong",
};

const tipKeys: Record<PasswordTip, StringKey> = {
  "avoid-personal-details": "passwordStrength.tip.avoidPersonalDetails",
  "avoid-common-passwords": "passwordStrength.tip.avoidCommonPasswords",
  "avoid-keyboard-patterns": "passwordStrength.tip.avoidKeyboardPatterns",
  "avoid-repeats": "passwordStrength.tip.avoidRepeats",
  "avoid-sequences": "passwordStrength.tip.avoidSequences",
  "avoid-dates": "passwordStrength.tip.avoidDates",
  "use-more-characters": "passwordStrength.tip.useMoreCharacters",
  "add-another-word": "passwordStrength.tip.addAnotherWord",
};

/** "Too weak", "Weak", "Good" or "Strong". */
export function strengthLabel(level: PasswordStrengthLevel): string {
  return t(levelKeys[level]);
}

export function tipText(tip: PasswordTip): string {
  return t(tipKeys[tip]);
}

/** What a screen reader hears once typing pauses: "Password strength: Weak. Add another word or two." */
export function strengthAnnouncement(strength: PasswordStrength): string {
  const label = t("passwordStrength.announcement", { level: strengthLabel(strength.level) });
  return strength.tip ? `${label} ${tipText(strength.tip)}` : label;
}
