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
  composeBrandedEmail(server, content)
    .then((email) => server.email.send({ to, ...email }))
    .catch((error: unknown) => {
      server.log.error({ error, subject: content.subject }, "Sending an email failed");
    });
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
