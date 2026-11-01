import { parseArgs } from "node:util";
import { z } from "zod";
import { loadConfig, loadProjectEnvFile } from "../config.js";
import { emailSchema } from "../users/users.schema.js";
import { createAdmin, EmailAlreadyUsedError } from "../users/users.service.js";
import { openConfiguredDatabase, runWithFriendlyErrors } from "../startup.js";
import { fail, readNewPassword } from "./read-new-password.js";

/**
 * Creates an Owner from the terminal:
 *
 *   pnpm create-admin --email ana@example.com --name "Ana Lopez"
 *
 * Most people never need this: the setup screen in the browser creates the first admin.
 * It is here for automated installs and for adding another admin by hand.
 *
 * The password is read from LINTEL_ADMIN_PASSWORD if set, otherwise asked for in the
 * terminal. Never take it as a flag: flags end up in shell history and the process list.
 */
const USAGE = 'Usage: pnpm create-admin --email <email> --name "<name>"';

const argumentsSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, { error: "Please give the admin a name" }),
});

await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const { values } = parseArgs({
    // pnpm passes a lone "--" through when people write `create-admin -- --email ...`.
    args: process.argv.slice(2).filter((argument) => argument !== "--"),
    options: { email: { type: "string" }, name: { type: "string" } },
  });

  const parsedArguments = argumentsSchema.safeParse(values);
  if (!parsedArguments.success) {
    fail(`${z.prettifyError(parsedArguments.error)}\n\n${USAGE}`);
  }

  const password = await readNewPassword("LINTEL_ADMIN_PASSWORD", "Nothing was created.");
  const activeDatabase = await openConfiguredDatabase(loadConfig());

  try {
    const admin = await createAdmin(activeDatabase.database, { ...parsedArguments.data, password });
    process.stdout.write(`Created ${admin.name} <${admin.email}> as an Owner.\n`);
  } catch (error) {
    if (!(error instanceof EmailAlreadyUsedError)) {
      throw error;
    }
    // Not fail(): exiting here would skip closing the database below.
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await activeDatabase.close();
  }
});
