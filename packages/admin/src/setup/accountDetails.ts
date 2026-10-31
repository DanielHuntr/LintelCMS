import { t } from "../i18n/strings.js";
import type { FirstAccountDetails } from "./setup.api.js";

export type AccountField = keyof FirstAccountDetails;
export type AccountErrors = Partial<Record<AccountField, string>>;

/** Matches the API's rule, so nobody is told "too short" only after pressing the button. */
export const minimumPasswordLength = 12;

export function passwordIsLongEnough(password: string): boolean {
  return password.length >= minimumPasswordLength;
}

/**
 * The details to send, trimmed, or what to fix first. The password is sent exactly as typed:
 * a space at the end of a passphrase is part of it.
 */
export function readAccountDetails(
  typed: FirstAccountDetails,
): { details: FirstAccountDetails; errors?: undefined } | { errors: AccountErrors } {
  const name = typed.name.trim();
  const email = typed.email.trim();

  const errors: AccountErrors = {};
  if (!name) errors.name = t("account.nameMissing");
  if (!email) errors.email = t("account.emailMissing");
  else if (!looksLikeEmail(email)) errors.email = t("account.emailInvalid");
  if (!passwordIsLongEnough(typed.password)) errors.password = t("account.passwordTooShort");

  if (Object.keys(errors).length > 0) return { errors };
  return { details: { name, email, password: typed.password } };
}

/** Something@something.something. The API has the final say; this only catches obvious slips. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * The API's 400 messages are plain English but don't name a field, so this places the message
 * by what it talks about. Undefined means it goes in the status line instead.
 */
export function fieldForAccountMessage(message: string): AccountField | undefined {
  const lowered = message.toLowerCase();
  if (lowered.includes("password")) return "password";
  if (lowered.includes("email")) return "email";
  if (lowered.includes("name")) return "name";
  return undefined;
}
