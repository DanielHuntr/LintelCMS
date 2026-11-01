import { z } from "zod";
import { WeakPasswordError } from "../auth/auth.errors.js";
import { newPasswordSchema } from "../users/users.schema.js";
import { requireStrongPassword } from "../users/users.service.js";
import { promptPassword } from "./prompt-password.js";

/**
 * Reads a new password for a script: from the named environment variable if it is set
 * (for automated setups), otherwise by asking in the terminal, twice. It must follow
 * the usual rules: at least 12 characters, and not easy to guess for someone who knows the
 * person's name and email (`owner`; leave the name empty when it isn't known yet).
 */
export async function readNewPassword(
  environmentVariable: string,
  nothingChanged: string,
  owner: { name: string; email: string },
): Promise<string> {
  const fromEnvironment = process.env[environmentVariable];
  const password = fromEnvironment ?? (await promptPassword("New password: "));

  const parsedPassword = newPasswordSchema.safeParse(password);
  if (!parsedPassword.success) {
    fail(z.prettifyError(parsedPassword.error));
  }
  failIfWeak(
    () => requireStrongPassword(parsedPassword.data, owner.name, owner.email),
    nothingChanged,
  );

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

/**
 * Runs a step that may refuse an easily guessed password (WeakPasswordError) and stops
 * with its advice. Other errors are thrown on as usual.
 */
export function failIfWeak(step: () => void, nothingChanged: string): void {
  try {
    step();
  } catch (error) {
    if (error instanceof WeakPasswordError) {
      fail(`${error.message} ${nothingChanged}`);
    }
    throw error;
  }
}

/** Prints a message for the person at the terminal and stops, without a stack trace. */
export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
