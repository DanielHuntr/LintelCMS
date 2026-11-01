import { z } from "zod";

/**
 * Handles name things in code and URLs: `blog_post`, `hero_image`. Kept to a safe, boring
 * set of characters so they work as JSON keys, in templates and in paths alike.
 */
export const HANDLE_PATTERN = /^[a-z][a-z0-9_]*$/;

export function handleSchema(missingMessage: string) {
  return z
    .string({ error: missingMessage })
    .min(1, { error: missingMessage })
    .max(64, { error: "Handles can be at most 64 characters" })
    .regex(HANDLE_PATTERN, {
      error: "Handles use lowercase letters, numbers and underscores, and start with a letter",
    });
}
