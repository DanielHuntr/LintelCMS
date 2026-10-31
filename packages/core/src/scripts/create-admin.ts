import { parseArgs } from "node:util";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { createDatabase } from "../database/client.js";
import { emailSchema, newPasswordSchema } from "../users/users.schema.js";
import { createAdmin, EmailAlreadyUsedError } from "../users/users.service.js";
import { promptPassword } from "./prompt-password.js";

/**
 * Creates the first admin, so someone can sign in to a fresh install:
 *
 *   pnpm --filter @lintel/core create-admin --email ana@example.com --name "Ana Lopez"
 *
 * The password is read from LINTEL_ADMIN_PASSWORD if set (for automated setups),
 * otherwise asked for in the terminal. Never take it as a flag: flags end up in
 * shell history and in the process list.
 */
const USAGE = 'Usage: pnpm --filter @lintel/core create-admin --email <email> --name "<name>"';

const argumentsSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, { error: "Please give the admin a name" }),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    // pnpm passes a lone "--" through when people write `create-admin -- --email ...`.
    args: process.argv.slice(2).filter((argument) => argument !== "--"),
    options: { email: { type: "string" }, name: { type: "string" } },
  });

  const parsedArguments = argumentsSchema.safeParse(values);
  if (!parsedArguments.success) {
    fail(`${z.prettifyError(parsedArguments.error)}\n\n${USAGE}`);
  }

  const password = await readPassword();
  const config = loadConfig();
  const { database, close } = createDatabase(config.DATABASE_URL);

  try {
    const admin = await createAdmin(database, { ...parsedArguments.data, password });
    process.stdout.write(`Created ${admin.name} <${admin.email}> as a Super admin.\n`);
  } catch (error) {
    if (error instanceof EmailAlreadyUsedError) {
      fail(error.message);
    }
    throw error;
  } finally {
    await close();
  }
}

async function readPassword(): Promise<string> {
  const fromEnvironment = process.env.LINTEL_ADMIN_PASSWORD;
  const password = fromEnvironment ?? (await promptPassword("Password: "));

  const parsedPassword = newPasswordSchema.safeParse(password);
  if (!parsedPassword.success) {
    fail(z.prettifyError(parsedPassword.error));
  }

  // Typing it twice catches a typo before it locks the only admin out.
  if (fromEnvironment === undefined && process.stdin.isTTY) {
    const confirmation = await promptPassword("Type the password again: ");
    if (confirmation !== password) {
      fail("The two passwords don't match. Nothing was created.");
    }
  }

  return parsedPassword.data;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

await main();
