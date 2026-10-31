import { t } from "../i18n/strings.js";
import type { FirstAccountDetails } from "./setup.api.js";

/**
 * The checks behind the name, email and password screens. Each returns what to fix, or
 * undefined when the answer is fine. The API has the final say; these only catch obvious slips
 * before anything is sent, so nobody is told "too short" three screens later.
 */

export type AccountField = keyof FirstAccountDetails;

/** Matches the API's rule. */
export const minimumPasswordLength = 12;

export function nameProblem(name: string): string | undefined {
  return name.trim() ? undefined : t("name.missing");
}

export function emailProblem(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return t("email.missing");
  return looksLikeEmail(trimmed) ? undefined : t("email.invalid");
}

export function passwordProblem(password: string): string | undefined {
  return passwordIsLongEnough(password) ? undefined : t("password.tooShort");
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
 * at the end of a passphrase is part of it.
 */
export function cleanAccountDetails(typed: FirstAccountDetails): FirstAccountDetails {
  return { name: typed.name.trim(), email: typed.email.trim(), password: typed.password };
}

/**
 * The API's 400 messages are plain English but don't name a field, so this places a message
 * by what it talks about. Undefined means it stays on the screen where it happened.
 */
export function fieldForAccountMessage(message: string): AccountField | undefined {
  const lowered = message.toLowerCase();
  if (lowered.includes("password")) return "password";
  if (lowered.includes("email")) return "email";
  if (lowered.includes("name")) return "name";
  return undefined;
}
