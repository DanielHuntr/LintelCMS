import type { FormField, FormFieldType } from "./form-fields.schema.js";

/**
 * Ready-made forms to start from, so nobody begins with a blank page. Each is an ordinary
 * form once created: every field can be changed or removed.
 */
export const formTemplateIds = [
  "blank",
  "contact",
  "newsletter",
  "quote_request",
  "event_booking",
] as const;

export type FormTemplateId = (typeof formTemplateIds)[number];

export interface FormTemplate {
  submitLabel: string;
  confirmationMessage: string;
  ownerSubject: string;
  /** Sent to the person who filled the form in, when the template turns it on. */
  confirmationEmail?: { subject: string; message: string };
  fields: FormField[];
}

function field(
  type: FormFieldType,
  handle: string,
  label: string,
  extra: Partial<Pick<FormField, "required" | "helpText" | "placeholder" | "options">> = {},
): FormField {
  return {
    id: handle,
    type,
    handle,
    label,
    helpText: "",
    placeholder: "",
    required: false,
    options: {},
    ...extra,
  };
}

const consentToBeContacted = field(
  "consent",
  "consent",
  "I agree to this site keeping my details to reply to me.",
  { required: true },
);

export const formTemplates: Record<FormTemplateId, FormTemplate> = {
  blank: {
    submitLabel: "Send",
    confirmationMessage: "Thanks! We've received your answers.",
    ownerSubject: "New {form} submission",
    fields: [],
  },
  contact: {
    submitLabel: "Send message",
    confirmationMessage: "Thanks for getting in touch. We'll reply as soon as we can.",
    ownerSubject: "New message from {name}",
    fields: [
      field("shortText", "name", "Your name", { required: true }),
      field("email", "email", "Email address", { required: true }),
      field("phone", "phone", "Phone number", { helpText: "Only if you'd like a call back" }),
      field("longText", "message", "Message", {
        required: true,
        options: { maxLength: 5000 },
      }),
      consentToBeContacted,
    ],
  },
  newsletter: {
    submitLabel: "Sign up",
    confirmationMessage: "You're on the list. Look out for our next newsletter.",
    ownerSubject: "New newsletter sign-up: {email}",
    fields: [
      field("shortText", "first_name", "First name"),
      field("email", "email", "Email address", { required: true }),
      field("consent", "consent", "Yes, send me the newsletter. I can unsubscribe at any time.", {
        required: true,
      }),
    ],
  },
  quote_request: {
    submitLabel: "Request a quote",
    confirmationMessage:
      "Thanks! We'll look at your project and send a quote within two working days.",
    ownerSubject: "Quote request from {name}",
    fields: [
      field("step", "about_you", "About you"),
      field("shortText", "name", "Your name", { required: true }),
      field("shortText", "company", "Company"),
      field("email", "email", "Email address", { required: true }),
      field("phone", "phone", "Phone number"),
      field("step", "your_project", "Your project"),
      field("dropdown", "service", "What do you need?", {
        required: true,
        options: { choices: ["Design", "Development", "Maintenance", "Something else"] },
      }),
      field("choice", "budget", "Budget", {
        options: { choices: ["Under £1,000", "£1,000 to £5,000", "Over £5,000", "Not sure yet"] },
      }),
      field("date", "deadline", "When do you need it by?"),
      field("longText", "details", "Tell us about the project", {
        required: true,
        options: { maxLength: 5000 },
      }),
      field("file", "attachments", "Briefs or examples", {
        helpText: "PDFs, documents or images, up to 10 MB each",
        options: { allowedKinds: ["images", "documents"], maxMegabytes: 10, maxFiles: 3 },
      }),
      consentToBeContacted,
    ],
  },
  event_booking: {
    submitLabel: "Book my place",
    confirmationMessage: "You're booked in. We've sent the details to your email.",
    ownerSubject: "New booking from {name}",
    confirmationEmail: {
      subject: "Your booking is confirmed",
      message: "Hello {name},\n\nThanks for booking. We look forward to seeing you.",
    },
    fields: [
      field("shortText", "name", "Your name", { required: true }),
      field("email", "email", "Email address", { required: true }),
      field("dropdown", "session", "Which session?", {
        required: true,
        options: { choices: ["Morning", "Afternoon", "Evening"] },
      }),
      field("number", "guests", "How many people?", {
        required: true,
        options: { min: 1, max: 10, wholeNumber: true },
      }),
      field("checkboxes", "dietary", "Dietary needs", {
        options: { choices: ["Vegetarian", "Vegan", "Gluten free", "Dairy free"] },
      }),
      field("longText", "notes", "Anything else we should know?"),
      field("hidden", "source", "Where the booking came from", {
        options: { defaultValue: "website" },
      }),
      consentToBeContacted,
    ],
  },
};
