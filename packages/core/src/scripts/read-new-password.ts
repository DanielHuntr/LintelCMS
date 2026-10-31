import { z } from "zod";
import { newPasswordSchema } from "../users/users.schema.js";
import { promptPassword } from "./prompt-password.js";

/**
 * Reads a new password for a script: from the named environment variable if it is set
 * (for automated setups), otherwise by asking in the terminal, twice. It must follow
 * the usual rules (at least 12 characters).
 */
export async function readNewPassword(
  environmentVariable: string,
  nothingChanged: string,
): Promise<string> {
  const fromEnvironment = process.env[environmentVariable];
  const password = fromEnvironment ?? (await promptPassword("New password: "));

  const parsedPassword = newPasswordSchema.safeParse(password);
  if (!parsedPassword.success) {
    fail(z.prettifyError(parsedPassword.error));
  }

  // Typing it twice catches a typo before it locks someone out. Piped input (not a
  // terminal) only has the one line, so there is nothing to compare.
  if (fromEnvironment === undefined && process.stdin.isTTY) {
    const confirmation = await promptPassword("Type the password again: ");
    if (confirmation !== password) {
      fail(`The two passwords don't match. ${nothingChanged}`);
    }
  }

  return parsedPassword.data;
}

/** Prints a message for the person at the terminal and stops, without a stack trace. */
export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
