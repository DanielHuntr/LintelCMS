import type { EmailMessage, EmailSender } from "../email/email-sender.js";
import { answerFields, type FormField } from "./form-fields.schema.js";
import type { Form } from "./forms.schema.js";
import { fileUrl, isFileList } from "./submission-responses.js";
import type { SubmissionValue, SubmissionValues } from "./submission-values.js";

/**
 * The emails a submission sends: one to the site owner with every answer, its reply-to set
 * to the person who filled the form in, and optionally a confirmation to that person.
 *
 * Subjects and the confirmation message can use `{form}` for the form's name and
 * `{handle}` for any answer, such as `{name}`.
 */
export function buildSubmissionEmails(
  form: Pick<Form, "name" | "fields" | "notifications">,
  values: SubmissionValues,
  submitterEmail: string | null,
  links: { publicApiUrl: string; inboxUrl: string },
): EmailMessage[] {
  const emails: EmailMessage[] = [];
  const { notifications } = form;
  const fill = (template: string) => fillPlaceholders(template, form, values, links.publicApiUrl);

  if (notifications.notifyOwner && notifications.recipients.length > 0) {
    emails.push({
      to: notifications.recipients,
      subject: oneLine(fill(notifications.subject)) || `New ${form.name} submission`,
      text: [
        `Someone filled in "${form.name}".`,
        "",
        answersAsText(form.fields, values, links.publicApiUrl),
        "",
        `See it in Lintel: ${links.inboxUrl}`,
      ].join("\n"),
      ...(submitterEmail ? { replyTo: submitterEmail } : {}),
    });
  }

  const confirmation = notifications.confirmationEmail;
  if (confirmation.enabled && submitterEmail) {
    emails.push({
      to: [submitterEmail],
      subject: oneLine(fill(confirmation.subject)) || form.name,
      text: [
        fill(confirmation.message),
        "",
        "What you sent:",
        "",
        answersAsText(form.fields, values, links.publicApiUrl),
      ].join("\n"),
      ...(notifications.recipients[0] ? { replyTo: notifications.recipients[0] } : {}),
    });
  }
  return emails;
}

export function answersAsText(
  fields: readonly FormField[],
  values: SubmissionValues,
  publicApiUrl: string,
): string {
  return answerFields(fields)
    .filter((field) => field.type !== "hidden" || values[field.handle] !== undefined)
    .map(
      (field) =>
        `${field.label}:\n${valueAsText(values[field.handle], publicApiUrl) || "(no answer)"}`,
    )
    .join("\n\n");
}

function valueAsText(value: SubmissionValue | undefined, publicApiUrl: string): string {
  if (value === undefined) return "";
  if (isFileList(value)) {
    return value
      .map((file) => `${file.filename}: ${fileUrl(publicApiUrl, file.assetId)}`)
      .join("\n");
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function fillPlaceholders(
  template: string,
  form: Pick<Form, "name">,
  values: SubmissionValues,
  publicApiUrl: string,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    if (name === "form") return form.name;
    return name in values ? valueAsText(values[name], publicApiUrl) : "";
  });
}

/** Subjects can't hold line breaks: an answer with one could otherwise add mail headers. */
function oneLine(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Sends each email, logging rather than failing: the submission is already saved. */
export async function sendSubmissionEmails(
  sender: EmailSender,
  emails: readonly EmailMessage[],
  onError: (error: unknown) => void,
): Promise<void> {
  for (const email of emails) {
    try {
      await sender.sendEmail(email);
    } catch (error) {
      onError(error);
    }
  }
}
