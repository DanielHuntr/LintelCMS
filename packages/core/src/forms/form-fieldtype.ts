import { z } from "zod";
import { defineFieldtype } from "../fieldtypes/fieldtype.js";
import { HANDLE_PATTERN } from "../http/handle.schema.js";

/**
 * A field that picks one of the site's forms, such as the Form block on pages. It stores
 * the form's handle, which is what websites ask for (`/delivery/forms/<handle>`, or the
 * embed script's `data-form`), and the delivery API serves it as that handle.
 *
 * A form deleted later leaves the handle behind; websites then get a 404 for it and the
 * embed script says the form can't be shown, rather than the page failing.
 */
export const formFieldtype = defineFieldtype({
  type: "form",
  name: "Form",
  description: "One of your forms, such as a contact form, to show on the page.",
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z
      .string({ error: `${label} should be a form` })
      .max(64)
      .regex(HANDLE_PATTERN, { error: `${label} should be a form's handle` }),
});
