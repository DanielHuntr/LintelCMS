import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import { type FormField, formFieldListSchema } from "./form-fields.schema.js";
import { formTemplateIds } from "./form-templates.js";

/** What people see once they've sent the form: a message, or another page. */
export const formConfirmationSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("message"),
      message: z
        .string({ error: "Write a thank-you message" })
        .trim()
        .min(1, { error: "Write a thank-you message" })
        .max(2000, { error: "The thank-you message can be at most 2000 characters" }),
    }),
    z.object({
      type: z.literal("redirect"),
      url: z
        .string({ error: "Give the address of the page to go to" })
        .trim()
        .max(2000)
        .refine((url) => /^(https?:\/\/[^\s]+|\/[^\s]*)$/.test(url), {
          error: "The page to go to should start with https://, http:// or /",
        }),
    }),
  ],
  { error: 'The confirmation should be a "message" or a "redirect"' },
);

export type FormConfirmation = z.infer<typeof formConfirmationSchema>;

const emailAddressSchema = z.email({ error: "Recipients should be email addresses" });

/**
 * Who is emailed when the form is sent. The site owner's email has the submitter as its
 * reply-to, so replying answers them. The submitter's confirmation goes to the first email
 * answer, only when there is one.
 */
export const formNotificationsSchema = z.object({
  notifyOwner: z.boolean().default(true),
  recipients: z
    .array(emailAddressSchema, { error: "Recipients should be a list of email addresses" })
    .max(10, { error: "A form can email at most 10 people" })
    .default([]),
  subject: z
    .string()
    .trim()
    .max(200, { error: "The subject can be at most 200 characters" })
    .default("New {form} submission"),
  confirmationEmail: z
    .object({
      enabled: z.boolean().default(false),
      subject: z.string().trim().max(200).default("Thanks for getting in touch"),
      message: z
        .string()
        .trim()
        .max(5000, { error: "The confirmation email can be at most 5000 characters" })
        .default("Thanks, we've received your message and will reply soon."),
    })
    .prefault({}),
});

export type FormNotifications = z.infer<typeof formNotificationsSchema>;

const nameSchema = z
  .string({ error: "Give the form a name" })
  .trim()
  .min(1, { error: "Give the form a name" })
  .max(100, { error: "Form names can be at most 100 characters" });

const retentionDaysSchema = z
  .number({ error: "Keep submissions for a number of days" })
  .int({ error: "Keep submissions for a whole number of days" })
  .min(1, { error: "Keep submissions for at least 1 day" })
  .max(3650, { error: "Submissions can be kept for at most 3650 days (ten years)" })
  .nullable();

const submitLabelSchema = z
  .string()
  .trim()
  .min(1, { error: "The button needs a label" })
  .max(60, { error: "The button label can be at most 60 characters" });

/** `POST /forms`: a name, and optionally a template to start from. */
export const createFormRequestSchema = z.object({
  name: nameSchema,
  handle: handleSchema("Give the form a handle").optional(),
  template: z
    .enum(formTemplateIds, { error: `Templates are: ${formTemplateIds.join(", ")}` })
    .default("blank"),
});

/** `PATCH /forms/:id`: anything that's sent changes; the rest stays. */
export const updateFormRequestSchema = z.object({
  name: nameSchema.optional(),
  handle: handleSchema("Give the form a handle").optional(),
  fields: formFieldListSchema.optional(),
  submitLabel: submitLabelSchema.optional(),
  confirmation: formConfirmationSchema.optional(),
  notifications: formNotificationsSchema.optional(),
  retentionDays: retentionDaysSchema.optional(),
  acceptingSubmissions: z.boolean().optional(),
});

export type CreateFormRequest = z.infer<typeof createFormRequestSchema>;
export type UpdateFormRequest = z.infer<typeof updateFormRequestSchema>;

export const formIdParamsSchema = z.object({ id: z.uuid() });
export const formHandleParamsSchema = z.object({ handle: z.string().max(64) });

/** A form as the admin sees it. */
export interface Form {
  id: string;
  handle: string;
  name: string;
  fields: FormField[];
  submitLabel: string;
  confirmation: FormConfirmation;
  notifications: FormNotifications;
  retentionDays: number | null;
  acceptingSubmissions: boolean;
  submissionCount: number;
  unreadCount: number;
  lastSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
