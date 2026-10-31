import { parseArgs } from "node:util";
import { z } from "zod";
import { loadConfig, loadProjectEnvFile } from "../config.js";
import { emailSchema } from "../users/users.schema.js";
import { resetPassword, UserNotFoundError } from "../users/users.service.js";
import { openConfiguredDatabase, runWithFriendlyErrors } from "../startup.js";
import { fail, readNewPassword } from "./read-new-password.js";

/**
 * Gives a locked-out user a new password and signs them out everywhere:
 *
 *   pnpm reset-password --email ana@example.com
 *
 * The password is read from LINTEL_NEW_PASSWORD if set, otherwise asked for twice in
 * the terminal. Never take it as a flag: flags end up in shell history.
 */
const USAGE = "Usage: pnpm reset-password --email <email>";

const argumentsSchema = z.object({ email: emailSchema });

await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const { values } = parseArgs({
    // pnpm passes a lone "--" through when people write `reset-password -- --email ...`.
    args: process.argv.slice(2).filter((argument) => argument !== "--"),
    options: { email: { type: "string" } },
  });

  const parsedArguments = argumentsSchema.safeParse(values);
  if (!parsedArguments.success) {
    fail(`${z.prettifyError(parsedArguments.error)}\n\n${USAGE}`);
  }

  const password = await readNewPassword("LINTEL_NEW_PASSWORD", "Nothing was changed.");
  const activeDatabase = await openConfiguredDatabase(loadConfig());

  try {
    const { user, endedSessions } = await resetPassword(
      activeDatabase.database,
      parsedArguments.data.email,
      password,
    );
    const signedOut = endedSessions === 1 ? "1 browser" : `${endedSessions} browsers`;
    process.stdout.write(
      `Changed the password for ${user.name} <${user.email}> and signed them out of ${signedOut}.\n`,
    );
  } catch (error) {
    if (!(error instanceof UserNotFoundError)) {
      throw error;
    }
    // Not fail(): exiting here would skip closing the database below.
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await activeDatabase.close();
  }
});
