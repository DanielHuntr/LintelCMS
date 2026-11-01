import { t } from "../i18n/strings.js";
import type { PasswordStrength } from "../password-strength/passwordStrength.js";
import type { FirstAccountDetails } from "./setup.api.js";

/**
 * The checks behind the "Create your account" screen. Each returns what to fix, or undefined
 * when the answer is fine. The API has the final say; these catch slips before anything is sent.
 */

/** What the screen asks for: the account details, and the password typed a second time. */
export interface AccountForm extends FirstAccountDetails {
  confirmPassword: string;
}

export type AccountField = keyof AccountForm;

/** The fields in the order they appear, so the first problem can be focused. */
export const accountFields: readonly AccountField[] = [
  "name",
  "email",
  "password",
  "confirmPassword",
];

export type AccountProblems = Partial<Record<AccountField, string>>;

/** Matches the API's rule (`MINIMUM_PASSWORD_LENGTH` in @lintel/core/password-strength). */
export const minimumPasswordLength = 12;

/**
 * Everything to fix before the account can be created. `strength` is undefined if the
 * checker couldn't load; then only the length is checked here and the API checks the rest.
 */
export function accountProblems(
  form: AccountForm,
  strength: PasswordStrength | undefined,
): AccountProblems {
  const problems: AccountProblems = {
    name: nameProblem(form.name),
    email: emailProblem(form.email),
    password: passwordProblem(form.password, strength),
    confirmPassword: confirmPasswordProblem(form.password, form.confirmPassword),
  };
  return Object.fromEntries(
    Object.entries(problems).filter(([, problem]) => problem !== undefined),
  ) as AccountProblems;
}

/** The first field with a problem, in screen order. */
export function firstProblemField(problems: AccountProblems): AccountField | undefined {
  return accountFields.find((field) => problems[field] !== undefined);
}

/**
 * Why "Create account" isn't ready, shown beside the button. Only the password decides:
 * the other fields explain themselves when the button is pressed.
 */
export function continueBlockedReason(
  password: string,
  strength: PasswordStrength | undefined,
): string | undefined {
  if (!password) return t("account.blocked.noPassword");
  if (!passwordIsLongEnough(password)) return t("account.blocked.short");
  if (strength && !strength.isStrongEnough) return t("account.blocked.weak");
  return undefined;
}

export function nameProblem(name: string): string | undefined {
  return name.trim() ? undefined : t("name.missing");
}

export function emailProblem(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return t("email.missing");
  return looksLikeEmail(trimmed) ? undefined : t("email.invalid");
}

export function passwordProblem(
  password: string,
  strength: PasswordStrength | undefined,
): string | undefined {
  if (!passwordIsLongEnough(password)) return t("password.tooShort");
  if (strength && !strength.isStrongEnough) return t("password.tooWeak");
  return undefined;
}

/** What is wrong with "Confirm password", or undefined once it matches. */
export function confirmPasswordProblem(password: string, confirmation: string): string | undefined {
  if (!confirmation) return t("confirmPassword.missing");
  return confirmation === password ? undefined : t("confirmPassword.mismatch");
}

export function passwordIsLongEnough(password: string): boolean {
  return password.length >= minimumPasswordLength;
}

/** Something@something.something. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * The details to send: name and email trimmed, the password exactly as typed, because a space
 * at the end of a passphrase is part of it. The confirmation stays in the browser.
 */
export function cleanAccountDetails(typed: AccountForm): FirstAccountDetails {
  return { name: typed.name.trim(), email: typed.email.trim(), password: typed.password };
}

/**
 * The API's 400 messages are plain English and mostly don't name a field, so this places a
 * message by what it talks about. Undefined means it is shown under the whole form.
 */
export function fieldForAccountMessage(message: string): keyof FirstAccountDetails | undefined {
  const lowered = message.toLowerCase();
  if (lowered.includes("password")) return "password";
  if (lowered.includes("email")) return "email";
  if (lowered.includes("name")) return "name";
  return undefined;
}
