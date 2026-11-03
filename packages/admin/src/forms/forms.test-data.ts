import type { Form, SubmissionDetail } from "./forms.types.js";

/** A contact form and a submission, shaped as the API sends them, for the screens' tests. */
export const contactForm: Form = {
  id: "f1",
  handle: "contact",
  name: "Contact",
  fields: [
    {
      id: "name",
      type: "shortText",
      handle: "name",
      label: "Your name",
      helpText: "",
      placeholder: "",
      required: true,
      options: {},
    },
    {
      id: "email",
      type: "email",
      handle: "email",
      label: "Email address",
      helpText: "",
      placeholder: "",
      required: true,
      options: {},
    },
    {
      id: "message",
      type: "longText",
      handle: "message",
      label: "Message",
      helpText: "",
      placeholder: "",
      required: false,
      options: {},
    },
  ],
  submitLabel: "Send message",
  confirmation: { type: "message", message: "Thanks!" },
  notifications: {
    notifyOwner: true,
    recipients: ["ada@example.com"],
    subject: "New message from {name}",
    confirmationEmail: { enabled: false, subject: "Thanks", message: "We'll reply soon." },
  },
  retentionDays: null,
  acceptingSubmissions: true,
  submissionCount: 1,
  unreadCount: 1,
  lastSubmittedAt: "2026-10-31T09:00:00Z",
  createdAt: "2026-10-30T09:00:00Z",
  updatedAt: "2026-10-30T09:00:00Z",
};

export const anaSubmission: SubmissionDetail = {
  id: "s1",
  formId: "f1",
  values: { name: "Ana Lima", email: "ana@example.com", message: "Please call me back." },
  submitterEmail: "ana@example.com",
  sourceUrl: "https://example.com/contact",
  consents: [
    {
      field: "consent",
      wording: "I agree to this site keeping my details to reply to me.",
      givenAt: "2026-10-31T09:00:00Z",
      page: "https://example.com/contact",
    },
  ],
  isRead: false,
  isStarred: false,
  createdAt: "2026-10-31T09:00:00Z",
  notes: [],
};
