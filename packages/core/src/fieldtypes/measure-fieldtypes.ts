import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";

/** A number picked on a slider, and a time of day. */

const rangeOptionsSchema = z
  .object({
    min: z.number({ error: "The minimum should be a number" }).default(0),
    max: z.number({ error: "The maximum should be a number" }).default(100),
    step: z
      .number({ error: "The step should be a number" })
      .positive({ error: "The step should be more than 0" })
      .default(1),
    /** Shown after the number, such as "%" or "px". */
    suffix: z
      .string({ error: "The suffix should be text" })
      .max(20, { error: "The suffix can be at most 20 characters" })
      .default(""),
  })
  .refine((options) => options.min < options.max, {
    error: "The minimum has to be less than the maximum",
  });

export const rangeFieldtype = defineFieldtype({
  type: "range",
  name: "Slider",
  description: "A number picked on a slider between two limits, such as an overlay's opacity.",
  category: "choices",
  keywords: ["range", "slider", "scale", "percentage", "opacity", "rating"],
  optionsSchema: rangeOptionsSchema,
  buildValueSchema: ({ min, max, step }, label) =>
    z
      .number({ error: `${label} should be a number` })
      .min(min, { error: `${label} should be at least ${min}` })
      .max(max, { error: `${label} should be at most ${max}` })
      .refine((value) => Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-9, {
        error: `${label} should go up in steps of ${step}`,
      }),
});

/** 24-hour "09:30", as the browser's time input gives it; seconds are allowed but not asked for. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const timeFieldtype = defineFieldtype({
  type: "time",
  name: "Time",
  description: "A time of day, such as when doors open.",
  category: "dates",
  keywords: ["clock", "hour", "opening time", "hh:mm"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z
      .string({ error: `${label} should be a time like 09:30` })
      .regex(TIME_PATTERN, { error: `${label} should be a time like 09:30` }),
});
