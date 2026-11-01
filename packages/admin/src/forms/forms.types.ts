/**
 * Forms and submissions exactly as the API sends them (see packages/core/src/forms).
 */

export const formFieldTypes = [
  "shortText",
  "longText",
  "email",
  "phone",
  "number",
  "choice",
  "checkboxes",
  "dropdown",
  "date",
  "file",
  "consent",
  "hidden",
  "step",
] as const;

export type FormFieldType = (typeof formFieldTypes)[number];

export type FileKind = "images" | "documents";

/** Every setting any form field can have. Each type reads only the ones that apply. */
export interface FormFieldOptions {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  wholeNumber?: boolean;
  choices?: string[];
  earliest?: string;
  latest?: string;
  allowedKinds?: FileKind[];
  maxMegabytes?: number;
  maxFiles?: number;
  defaultValue?: string;
}

export interface FormField {
  /** Made when the field is added; never changes. */
  id: string;
  type: FormFieldType;
  handle: string;
  label: string;
  helpText: string;
  placeholder: string;
  required: boolean;
  options: FormFieldOptions;
}

export type FormConfirmation =
  { type: "message"; message: string } | { type: "redirect"; url: string };

export interface FormNotifications {
  notifyOwner: boolean;
  recipients: string[];
  subject: string;
  confirmationEmail: { enabled: boolean; subject: string; message: string };
}

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

export type FormChanges = Partial<
  Pick<
    Form,
    | "name"
    | "handle"
    | "fields"
    | "submitLabel"
    | "confirmation"
    | "notifications"
    | "retentionDays"
    | "acceptingSubmissions"
  >
>;

export const formTemplateIds = [
  "blank",
  "contact",
  "newsletter",
  "quote_request",
  "event_booking",
] as const;

export type FormTemplateId = (typeof formTemplateIds)[number];

export interface SubmittedFile {
  assetId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export type SubmissionValue = string | number | boolean | string[] | SubmittedFile[];

export interface SubmissionNote {
  id: string;
  body: string;
  author: { id: string; name: string } | null;
  createdAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  values: Record<string, SubmissionValue>;
  submitterEmail: string | null;
  sourceUrl: string | null;
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
}

export interface SubmissionDetail extends Submission {
  notes: SubmissionNote[];
}

export type SubmissionFilter = "all" | "unread" | "starred";

export interface SubmissionQuery {
  search: string;
  filter: SubmissionFilter;
  page: number;
}

export interface FormsSettings {
  turnstileSiteKey: string | null;
  hasTurnstileSecret: boolean;
}

export interface PersonalDataExport {
  email: string;
  exportedAt: string;
  submissions: Array<Submission & { form: { handle: string; name: string } }>;
}
