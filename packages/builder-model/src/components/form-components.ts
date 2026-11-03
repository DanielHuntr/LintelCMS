import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import { plainText } from "./component-props.js";

/**
 * Forms made in the Forms section, placed on a page. The page draws the form's fields from
 * the Forms plugin, so changing the form there changes it everywhere it is used.
 */

export const formHandleSchema = z
  .string()
  .regex(/^([a-z0-9][a-z0-9_-]{0,63})?$/, { error: "A form should be chosen by its handle" })
  .default("");

export const formEmbedComponent = defineComponent({
  type: "formEmbed",
  label: "Form",
  keywords: ["contact form", "enquiry"],
  description: "One of the forms from Forms, such as your contact form.",
  icon: "clipboard-list",
  category: "forms",
  requiresPlugin: "forms",
  propsSchema: z.object({
    form: formHandleSchema,
    showTitle: z.boolean().default(false),
  }),
  defaultProps: { form: "", showTitle: false },
  allowedChildren: "none",
  editableFields: [
    { kind: "source", source: "forms", prop: "form", label: "Which form" },
    { kind: "toggle", prop: "showTitle", label: "Show the form’s name above it" },
  ],
});

export const newsletterSignupComponent = defineComponent({
  type: "newsletterSignup",
  label: "Newsletter sign-up",
  keywords: ["email", "subscribe", "mailing list"],
  description: "An email box and a button, for people to join your mailing list.",
  icon: "mail-plus",
  category: "forms",
  requiresPlugin: "forms",
  propsSchema: z.object({
    form: formHandleSchema,
    title: plainText(200, "Get our newsletter"),
    text: plainText(500, "News and offers, once a month. Leave whenever you like."),
    emailLabel: plainText(80, "Email address"),
    buttonLabel: plainText(60, "Sign up"),
  }),
  defaultProps: {
    form: "",
    title: "Get our newsletter",
    text: "News and offers, once a month. Leave whenever you like.",
    emailLabel: "Email address",
    buttonLabel: "Sign up",
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "source", source: "forms", prop: "form", label: "Form that collects the addresses" },
    { kind: "text", prop: "title", label: "Title" },
    { kind: "multilineText", prop: "text", label: "A sentence about it" },
    { kind: "text", prop: "emailLabel", label: "Label for the email box", advanced: true },
    { kind: "text", prop: "buttonLabel", label: "Words on the button" },
  ],
});
