import { z } from "zod";
import type { FieldMessages } from "../http/http-errors.js";
import { answerFields, type FormField, optionsOf } from "./form-fields.schema.js";

/**
 * Checking what someone typed into a form, on the server, whatever the browser checked.
 * Answers arrive as JSON or as an HTML form post, where everything is text, so each check
 * accepts the text form too ("3" for a number, "on" for a ticked box).
 */

/** A file someone sent, stored in the media library. */
export interface SubmittedFile {
  assetId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export type SubmissionValue = string | number | boolean | string[] | SubmittedFile[];
export type SubmissionValues = Record<string, SubmissionValue>;

/** Longest answers when the form doesn't set its own limit. */
const DEFAULT_LONGEST = { shortText: 1000, longText: 10000 } as const;
const LONGEST_EMAIL = 254;
const PHONE_PATTERN = /^\+?[0-9 ().\-/]{5,30}( ?(ext\.?|x) ?[0-9]{1,6})?$/i;
const TICKED = new Set(["true", "on", "yes", "1"]);
const emailSchema = z.email();

type CheckResult = { value: SubmissionValue } | { problem: string } | { empty: true };

/**
 * Checks every answer except files (see submission-files.ts). Returns the answers to
 * store, keyed by handle and without empty ones, and a message for each problem.
 */
export function checkSubmissionValues(
  fields: readonly FormField[],
  input: Readonly<Record<string, unknown>>,
): { values: SubmissionValues; messages: FieldMessages } {
  const values: SubmissionValues = {};
  const messages: FieldMessages = {};

  for (const field of answerFields(fields)) {
    if (field.type === "file") {
      continue;
    }
    const result = checkAnswer(field, input[field.handle]);
    if ("problem" in result) {
      messages[field.handle] = result.problem;
    } else if ("empty" in result) {
      if (field.required) {
        messages[field.handle] = requiredMessage(field);
      }
    } else {
      values[field.handle] = result.value;
    }
  }
  return { values, messages };
}

export function requiredMessage(field: FormField): string {
  return field.type === "consent"
    ? "Please tick this box to continue"
    : `${field.label} is required`;
}

function checkAnswer(field: FormField, raw: unknown): CheckResult {
  switch (field.type) {
    case "shortText":
    case "longText":
      return checkText(field, raw, field.type);
    case "email":
      return checkEmail(field, raw);
    case "phone":
      return checkPhone(field, raw);
    case "number":
      return checkNumber(field, raw);
    case "choice":
    case "dropdown":
      return checkSingleChoice(field, raw);
    case "checkboxes":
      return checkManyChoices(field, raw);
    case "date":
      return checkDate(field, raw);
    case "consent":
      return isTicked(raw) ? { value: true } : { empty: true };
    case "hidden":
      return checkHidden(field, raw);
    default:
      return { empty: true };
  }
}

/** A single text answer: a string, or the last of several sent under one name. */
function textOf(raw: unknown): string | undefined {
  const single = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (typeof single === "string") return single.trim();
  if (typeof single === "number" && Number.isFinite(single)) return String(single);
  return undefined;
}

function checkText(field: FormField, raw: unknown, type: "shortText" | "longText"): CheckResult {
  const text = textOf(raw);
  if (text === undefined || text === "") {
    return raw === undefined || raw === null || text === "" ? { empty: true } : notText(field);
  }
  const { minLength, maxLength } = optionsOf(field, type);
  const longest = maxLength ?? DEFAULT_LONGEST[type];
  if (text.length > longest) {
    return { problem: `${field.label} can be at most ${longest} characters` };
  }
  if (minLength !== undefined && text.length < minLength) {
    return { problem: `${field.label} needs at least ${minLength} characters` };
  }
  return { value: text };
}

function notText(field: FormField): CheckResult {
  return { problem: `${field.label} should be text` };
}

function checkEmail(field: FormField, raw: unknown): CheckResult {
  const text = textOf(raw);
  if (!text) return { empty: true };
  if (text.length > LONGEST_EMAIL || !emailSchema.safeParse(text).success) {
    return { problem: `${field.label} doesn't look like an email address` };
  }
  return { value: text };
}

function checkPhone(field: FormField, raw: unknown): CheckResult {
  const text = textOf(raw);
  if (!text) return { empty: true };
  const digits = text.replace(/\D/g, "").length;
  if (!PHONE_PATTERN.test(text) || digits < 5) {
    return { problem: `${field.label} doesn't look like a phone number` };
  }
  return { value: text };
}

function checkNumber(field: FormField, raw: unknown): CheckResult {
  const text = textOf(raw);
  if (text === undefined || text === "") return { empty: true };
  const number = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(number)) {
    return { problem: `${field.label} should be a number` };
  }
  const { min, max, wholeNumber } = optionsOf(field, "number");
  if (wholeNumber && !Number.isInteger(number)) {
    return { problem: `${field.label} should be a whole number` };
  }
  if (min !== undefined && number < min) {
    return { problem: `${field.label} should be ${min} or more` };
  }
  if (max !== undefined && number > max) {
    return { problem: `${field.label} should be ${max} or less` };
  }
  return { value: number };
}

function choicesOf(field: FormField): readonly string[] {
  if (field.type === "choice" || field.type === "dropdown" || field.type === "checkboxes") {
    return optionsOf(field, field.type).choices;
  }
  return [];
}

function checkSingleChoice(field: FormField, raw: unknown): CheckResult {
  const text = textOf(raw);
  if (!text) return { empty: true };
  const choices = choicesOf(field);
  return choices.includes(text)
    ? { value: text }
    : { problem: `${field.label} should be one of: ${choices.join(", ")}` };
}

function checkManyChoices(field: FormField, raw: unknown): CheckResult {
  const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  const picked = [...new Set(list.map(textOf).filter((text): text is string => Boolean(text)))];
  if (picked.length === 0) return { empty: true };
  const choices = choicesOf(field);
  const unknown = picked.find((choice) => !choices.includes(choice));
  if (unknown !== undefined) {
    return { problem: `${field.label} doesn't have a choice called "${unknown}"` };
  }
  // Kept in the form's order, so answers read the same way in the inbox and the export.
  return { value: choices.filter((choice) => picked.includes(choice)) };
}

function checkDate(field: FormField, raw: unknown): CheckResult {
  const text = textOf(raw);
  if (!text) return { empty: true };
  if (!isRealDate(text)) {
    return { problem: `${field.label} should be a date, like 2026-12-31` };
  }
  const { earliest, latest } = optionsOf(field, "date");
  if (earliest !== undefined && text < earliest) {
    return { problem: `${field.label} should be on or after ${earliest}` };
  }
  if (latest !== undefined && text > latest) {
    return { problem: `${field.label} should be on or before ${latest}` };
  }
  return { value: text };
}

function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

function checkHidden(field: FormField, raw: unknown): CheckResult {
  const text = textOf(raw);
  const value = text === undefined || text === "" ? optionsOf(field, "hidden").defaultValue : text;
  if (value === "") return { empty: true };
  return value.length > 1000
    ? { problem: `${field.label} can be at most 1000 characters` }
    : { value };
}

function isTicked(raw: unknown): boolean {
  if (raw === true) return true;
  const text = textOf(raw);
  return text !== undefined && TICKED.has(text.toLowerCase());
}

/** The first email answer, lowercased: who the submission belongs to, for privacy requests. */
export function findSubmitterEmail(
  fields: readonly FormField[],
  values: SubmissionValues,
): string | null {
  for (const field of fields) {
    const value = values[field.handle];
    if (field.type === "email" && typeof value === "string") {
      return value.toLowerCase();
    }
  }
  return null;
}
