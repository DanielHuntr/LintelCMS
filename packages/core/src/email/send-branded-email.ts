import type { FastifyInstance } from "fastify";
import { type BrandedEmailContent, renderBrandedEmail } from "../branding/branded-email.js";
import { describePublicBranding, readBranding } from "../branding/branding.service.js";

/**
 * Sends one of the admin's own emails (an invitation, a password reset, a security notice)
 * in the site's branding: the agency's name in the subject and sign-off, its logo, colour
 * and support address (see src/branding). Like `sendEmail`, it doesn't wait and never
 * throws; a failure is logged.
 */
export function sendBrandedEmail(
  server: FastifyInstance,
  to: string,
  content: BrandedEmailContent,
): void {
  const sending = composeBrandedEmail(server, content)
    .then((email) => server.email.send({ to, ...email }))
    .then(() => undefined)
    .catch((error: unknown) => {
      server.log.error({ error, subject: content.subject }, "Sending an email failed");
    })
    .finally(() => emailsOnTheirWay.delete(sending));
  emailsOnTheirWay.add(sending);
}

const emailsOnTheirWay = new Set<Promise<void>>();

/** Finishes when every email started so far has gone. Requests don't wait for them. */
export async function emailsSent(): Promise<void> {
  await Promise.all(emailsOnTheirWay);
}

/** The email as it would be sent: subject, plain text and HTML in the current branding. */
export async function composeBrandedEmail(
  server: FastifyInstance,
  content: BrandedEmailContent,
): Promise<{ subject: string; text: string; html: string }> {
  const branding = await readBranding(server.database, server.deploymentBranding);
  const email = renderBrandedEmail(describePublicBranding(branding, server.publicApiUrl), content);
  return { subject: email.subject, text: email.text, html: email.html };
}
