import type { FastifyInstance } from "fastify";
import { buildSubmissionEmails, sendSubmissionEmails } from "./form-notifications.js";
import type { FormRow, FormSubmissionRow } from "./forms.table.js";
import { toSubmissionResponse } from "./submission-responses.js";

/**
 * Tells everyone about a new submission: the emails the form asks for (through src/email),
 * then `form.submitted` on the event bus, which webhooks (Slack, Zapier, a CRM...) and
 * automations listen to. The submission is already saved, so a failure here is logged
 * rather than shown to the visitor.
 */
export async function announceFormSubmitted(
  server: FastifyInstance,
  form: FormRow,
  submission: FormSubmissionRow,
  options: { fromRobot?: boolean } = {},
): Promise<void> {
  const inboxUrl = `${server.adminOrigin}/forms/${form.id}/submissions?submission=${submission.id}`;
  const emails = buildSubmissionEmails(form, submission.values, submission.submitterEmail, {
    publicApiUrl: server.publicApiUrl,
    inboxUrl,
  });
  await sendSubmissionEmails(server.email, emails, (error) =>
    server.log.error(error, `Emailing about a "${form.handle}" submission failed`),
  );

  const response = toSubmissionResponse(submission, server.publicApiUrl);
  await server.events.publish(
    "form.submitted",
    {
      form: { id: form.id, handle: form.handle, name: form.name },
      submission: {
        id: response.id,
        createdAt: response.createdAt,
        fields: response.values,
        submitterEmail: response.submitterEmail,
        url: inboxUrl,
      },
    },
    { actor: null, now: submission.createdAt, ...options },
  );
}
