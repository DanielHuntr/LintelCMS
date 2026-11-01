import { z } from "zod";

/**
 * Building blocks for the settings in config.ts. Environment variables are always text,
 * and people copy `.env.example` with its empty `NAME=` lines, so an empty value counts
 * as "not set" everywhere.
 */

function emptyAsUnset(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** A setting that may be left out. */
export function optionalSetting<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess(emptyAsUnset, schema.optional());
}

/** A setting with a default, used when it is left out or empty. */
export function settingWithDefault<Schema extends z.ZodType>(
  schema: Schema,
  defaultValue: z.input<Schema>,
) {
  return z.preprocess((value) => emptyAsUnset(value) ?? defaultValue, schema);
}

const TRUE_WORDS = ["true", "yes", "on", "1"];
const FALSE_WORDS = ["false", "no", "off", "0"];

/** true/false, also accepting yes/no, on/off and 1/0, in any case. */
export function yesOrNoSetting(defaultValue: boolean) {
  return settingWithDefault(
    z
      .string()
      .transform((value) => value.trim().toLowerCase())
      .refine((value) => TRUE_WORDS.includes(value) || FALSE_WORDS.includes(value), {
        error: "Should be true or false",
      })
      .transform((value) => TRUE_WORDS.includes(value)),
    String(defaultValue),
  );
}

/** A whole number of seconds, minutes or bytes: at least `minimum`. */
export function wholeNumberSetting(defaultValue: number, minimum = 1) {
  return settingWithDefault(
    z.coerce
      .number({ error: "Should be a number" })
      .int({ error: "Should be a whole number" })
      .min(minimum, { error: `Should be at least ${minimum}` }),
    defaultValue,
  );
}

/** A web address starting with http:// or https://. */
export const webAddress = z
  .string()
  .trim()
  .refine(isWebAddress, { error: "Should be a full address starting with https:// or http://" });

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
