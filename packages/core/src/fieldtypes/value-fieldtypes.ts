import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";

/** Fieldtypes for single values: numbers, on/off switches and dates. */

const numberOptionsSchema = z
  .object({
    min: z.number({ error: "The minimum should be a number" }).optional(),
    max: z.number({ error: "The maximum should be a number" }).optional(),
    step: z
      .number({ error: "The step should be a number" })
      .positive({ error: "The step should be more than 0" })
      .optional(),
  })
  .refine(
    (options) =>
      options.min === undefined || options.max === undefined || options.min <= options.max,
    {
      error: "The minimum can't be more than the maximum",
    },
  );

export const numberFieldtype = defineFieldtype({
  type: "number",
  name: "Number",
  description: "A number, such as a price, a quantity or a rating.",
  category: "choices",
  keywords: ["integer", "decimal", "price", "quantity", "amount", "digit"],
  optionsSchema: numberOptionsSchema,
  buildValueSchema: ({ min, max, step }, label) => {
    let number = z.number({ error: `${label} should be a number` });
    if (min !== undefined) {
      number = number.min(min, { error: `${label} should be at least ${min}` });
    }
    if (max !== undefined) {
      number = number.max(max, { error: `${label} should be at most ${max}` });
    }
    if (step === undefined) {
      return number;
    }
    return number.refine((value) => isOnStep(value, min ?? 0, step), {
      error: `${label} should go up in steps of ${step}`,
    });
  },
});

/** Allows for floating point, so 0.3 counts as a step of 0.1 from 0. */
function isOnStep(value: number, start: number, step: number): boolean {
  const steps = (value - start) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

export const toggleFieldtype = defineFieldtype({
  type: "toggle",
  name: "Toggle",
  description: "An on or off switch, such as “Show in the menu”.",
  category: "choices",
  keywords: ["boolean", "switch", "checkbox", "yes no", "true false"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) => z.boolean({ error: `${label} should be on or off` }),
});

export const dateFieldtype = defineFieldtype({
  type: "date",
  name: "Date",
  description: "A calendar date, with a time of day if you need one.",
  category: "dates",
  keywords: ["calendar", "day", "datetime", "when", "schedule"],
  optionsSchema: z.object({
    includeTime: z.boolean({ error: "includeTime should be true or false" }).default(false),
  }),
  buildValueSchema: ({ includeTime }, label) => {
    const date = z.iso.date({ error: `${label} should be a date like 2026-10-31` });
    if (!includeTime) {
      return date;
    }
    // The browser's date-and-time input gives a local time with no offset, so allow that too.
    const dateTime = z.iso.datetime({ local: true, offset: true });
    return z.union([dateTime, date], {
      error: `${label} should be a date like 2026-10-31, or a date and time like 2026-10-31T09:30`,
    });
  },
});
