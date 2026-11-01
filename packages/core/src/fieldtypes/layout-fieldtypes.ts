import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";

/**
 * Fields that arrange the editor rather than hold content. A tab starts a new tab of the
 * entry editor, a section heading starts a titled part of it, and a spacer leaves room so the
 * next field starts on a new line. They store nothing and never reach the API.
 *
 * A revealer is the exception: a "Show more" button whose on/off value other fields' conditions
 * can look at. Its value is saved like a toggle's, so the editor opens the way it was left.
 */

export const tabFieldtype = defineFieldtype({
  type: "tab",
  name: "Tab",
  description: "Starts a new tab in the editor, to split a long form into parts such as SEO.",
  category: "layout",
  keywords: ["tabs", "page", "panel", "split"],
  holdsValue: false,
  canBeInside: false,
  optionsSchema: z.object({}),
  buildValueSchema: () => z.never(),
});

export const sectionFieldtype = defineFieldtype({
  type: "section",
  name: "Section heading",
  description: "A heading with a sentence under it, to start a new part of the form.",
  category: "layout",
  keywords: ["heading", "divider", "title", "instructions", "separator", "fieldset legend"],
  holdsValue: false,
  optionsSchema: z.object({}),
  buildValueSchema: () => z.never(),
});

export const spacerFieldtype = defineFieldtype({
  type: "spacer",
  name: "Spacer",
  description: "Empty room, so the next field starts further along or on a new line.",
  category: "layout",
  keywords: ["gap", "blank", "empty", "space", "padding"],
  holdsValue: false,
  optionsSchema: z.object({}),
  buildValueSchema: () => z.never(),
});

export const revealerFieldtype = defineFieldtype({
  type: "revealer",
  name: "Show more",
  description:
    "A button that shows more fields when pressed, to keep extra options out of the way.",
  category: "layout",
  keywords: ["revealer", "expand", "toggle", "collapse", "advanced", "more options"],
  optionsSchema: z.object({
    /** The button's words, such as "Show booking options". Empty for "Show more". */
    buttonLabel: z.string({ error: "The button's words should be text" }).max(60).default(""),
  }),
  buildValueSchema: (_options, label) => z.boolean({ error: `${label} should be on or off` }),
});
