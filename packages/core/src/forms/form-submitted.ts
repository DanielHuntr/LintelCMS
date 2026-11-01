import type { FastifyInstance } from "fastify";
import { queueWebhookEvent } from "../webhooks/webhook-deliveries.service.js";
import { buildSubmissionEmails, sendSubmissionEmails } from "./form-notifications.js";
import type { FormRow, FormSubmissionRow } from "./forms.table.js";
import { toSubmissionResponse } from "./submission-responses.js";

/**
 * Everyone who hears about a new submission, in one visible list: the emails the form asks
 * for, and webhooks listening for `form.submitted` (Slack, Zapier, a CRM...). The
 * submission is already saved, so a failure here is logged rather than shown to the visitor.
 */
export async function announceFormSubmitted(
  server: FastifyInstance,
  form: FormRow,
  submission: FormSubmissionRow,
  adminOrigin: string,
): Promise<void> {
  const inboxUrl = `${adminOrigin.replace(/\/+$/, "")}/forms/${form.id}/submissions?submission=${submission.id}`;
  const emails = buildSubmissionEmails(form, submission.values, submission.submitterEmail, {
    publicApiUrl: server.publicApiUrl,
    inboxUrl,
  });
  await sendSubmissionEmails(server.email, emails, (error) =>
    server.log.error(error, `Emailing about a "${form.handle}" submission failed`),
  );

  try {
    const response = toSubmissionResponse(submission, server.publicApiUrl);
    const who = submission.submitterEmail ? ` from ${submission.submitterEmail}` : "";
    const queued = await queueWebhookEvent(
      server.database,
      "form.submitted",
      {
        form: { id: form.id, handle: form.handle, name: form.name },
        submission: {
          id: response.id,
          createdAt: response.createdAt,
          values: response.values,
          submitterEmail: response.submitterEmail,
          url: inboxUrl,
        },
      },
      submission.createdAt,
      `New ${form.name} submission${who}: ${inboxUrl}`,
    );
    if (queued > 0) {
      server.webhooks.deliverSoon();
    }
  } catch (error) {
    server.log.error(error, `Telling webhooks about a "${form.handle}" submission failed`);
  }
}
