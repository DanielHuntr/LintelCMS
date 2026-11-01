import { parseArgs } from "node:util";
import { z } from "zod";
import { loadConfig, loadProjectEnvFile } from "../config.js";
import { createConfiguredEmailSender, EmailNotSentError } from "../email/index.js";
import { lintelPaths, runWithFriendlyErrors } from "../startup.js";
import { fail } from "./read-new-password.js";

/**
 * Sends one email with the email settings, to check them before anyone relies on them:
 *
 *   pnpm send-test-email --to you@example.com
 */
const USAGE = "Usage: pnpm send-test-email --to <email>";

await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== "--"),
    options: { to: { type: "string" } },
  });
  const to = z.email().safeParse(values.to);
  if (!to.success) {
    fail(`Which address should the test email go to?\n\n${USAGE}`);
  }

  const config = loadConfig();
  const email = createConfiguredEmailSender(config, lintelPaths(config).root);
  try {
    await email.send({
      to: to.data,
      subject: "Lintel can send email",
      text: "This is a test from Lintel. If you can read it, your email settings work.",
    });
  } catch (error) {
    if (error instanceof EmailNotSentError) fail(error.message);
    throw error;
  }

  process.stdout.write(
    email.keepsInOutbox
      ? `The email was put in the outbox (${email.description}). Set EMAIL_DRIVER to send for real.\n`
      : `Sent to ${to.data} through ${email.description}. Check the inbox (and the spam folder).\n`,
  );
});
