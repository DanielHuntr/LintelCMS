import { z } from "zod";

/**
 * Every setting the API server reads from the environment, in one place.
 * If a value is missing or malformed the server refuses to start and says which one,
 * instead of failing later in some unrelated part of the code.
 */
const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5173"),
  // Defaults to production so a server started without it gets the safe settings
  // (for example, session cookies that only travel over HTTPS).
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(environment);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Lintel can't start because some settings are wrong:\n${problems}`);
  }

  return result.data;
}
