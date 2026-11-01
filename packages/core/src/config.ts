import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DATABASE_URL_ADVICE } from "./database/database-errors.js";
import { checkEmailSettings, emailSettings } from "./email/email.config.js";
import { checkStorageSettings, storageSettings } from "./media/storage.config.js";
import { checkProductionSettings, productionSettings } from "./production/production.config.js";

/**
 * Every setting the API server reads from the environment, in one place. Each one has a
 * default, so Lintel starts with no .env file at all. If a value is set but malformed the
 * server refuses to start and says which one, instead of failing later somewhere else.
 */
const coreSettingsSchema = z.object({
  // Leave out to use the built-in database, or the one chosen on the setup screen.
  // An empty `DATABASE_URL=` line (copied from .env.example) counts as left out.
  DATABASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .refine(isPostgresUrl, {
        error: `This isn't a valid Postgres address. ${DATABASE_URL_ADVICE}`,
      })
      .optional(),
  ),
  API_PORT: z.coerce.number().int().positive().default(4000),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5173"),
  // The API's address as browsers reach it, used in the URLs of uploaded files. Set it when
  // the API sits behind a domain or proxy; it defaults to http://localhost:<API_PORT>.
  API_PUBLIC_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  // Defaults to production so a server started without it gets the safe settings
  // (for example, session cookies that only travel over HTTPS). `pnpm dev` sets it
  // to development (see packages/core/development.env).
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  // Lets webhooks go to localhost and private network addresses, for testing a receiver on
  // your own machine. Leave it off on a real server (see src/webhooks/README.md).
  WEBHOOKS_ALLOW_PRIVATE_ADDRESSES: z
    .enum(["true", "false", ""])
    .default("false")
    .transform((value) => value === "true"),
});

/**
 * Each feature that has settings keeps them in its own `*.config.ts`, next to the code
 * that uses them, along with the rules that need more than one setting.
 */
const configSchema = coreSettingsSchema
  .extend(productionSettings)
  .extend(storageSettings)
  .extend(emailSettings)
  .superRefine((config, context) => {
    checkProductionSettings(config, context);
    checkStorageSettings(config, context);
    checkEmailSettings(config, context);
  });

export type Config = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  constructor(problems: string) {
    super(`Lintel can't start because some settings are wrong:\n${problems}`);
    this.name = "ConfigError";
  }
}

/** The optional .env file at the repository root; the same place from `src` and `dist`. */
const PROJECT_ENV_FILE = fileURLToPath(new URL("../../../.env", import.meta.url));

/**
 * Reads the root .env file into the environment, if there is one. Most people won't have
 * one, so its absence is not worth a warning (Node's --env-file-if-exists prints one).
 * Real environment variables win, because loadEnvFile never overwrites them.
 */
export function loadProjectEnvFile(envFile = PROJECT_ENV_FILE): void {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(environment);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new ConfigError(problems);
  }

  return result.data;
}

/**
 * A password with an unencoded "#" or "/" makes the URL unreadable (everything after a
 * "#" is dropped, and a "/" ends the host part), which is the usual way this fails.
 */
function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname !== "";
  } catch {
    return false;
  }
}
