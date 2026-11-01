import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";
import { choicesSchema, oneChoiceSchema } from "./reference-fieldtypes.js";

/**
 * Choices shown all at once rather than in a menu: radio buttons (pick one), checkboxes
 * (pick any) and a button group (pick one, as a row of buttons, for short lists such as
 * Left / Centre / Right). They take the same `choices` as a select field.
 */

export const radioFieldtype = defineFieldtype({
  type: "radio",
  name: "Radio buttons",
  description: "One choice from a short list, with every choice in view.",
  category: "choices",
  keywords: ["radio", "option", "single choice", "pick one"],
  optionsSchema: z.object({
    choices: choicesSchema("A radio buttons field"),
    inline: z.boolean({ error: "inline should be true or false" }).default(false),
  }),
  buildValueSchema: ({ choices }, label) => oneChoiceSchema(choices, label),
});

export const checkboxesFieldtype = defineFieldtype({
  type: "checkboxes",
  name: "Checkboxes",
  description: "Any number of choices from a list, such as the facilities a venue has.",
  category: "choices",
  keywords: ["checkbox", "tick", "multi select", "multiple choice", "options"],
  optionsSchema: z.object({
    choices: choicesSchema("A checkboxes field"),
    inline: z.boolean({ error: "inline should be true or false" }).default(false),
  }),
  buildValueSchema: ({ choices }, label) =>
    z
      .array(oneChoiceSchema(choices, label), { error: `${label} should be a list of choices` })
      .refine((values) => new Set(values).size === values.length, {
        error: `${label} lists the same choice twice`,
      }),
});

export const buttonGroupFieldtype = defineFieldtype({
  type: "buttonGroup",
  name: "Button group",
  description: "One choice from a few, as a row of buttons, such as Left, Centre or Right.",
  category: "choices",
  keywords: ["segmented", "toggle group", "alignment", "tabs", "switcher"],
  optionsSchema: z.object({ choices: choicesSchema("A button group") }),
  buildValueSchema: ({ choices }, label) => oneChoiceSchema(choices, label),
});
