import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env on its own, so load the project's .env here.
// Real environment variables still win, because loadEnvFile never overwrites them.
const projectEnvFile = "../../.env";
if (existsSync(projectEnvFile)) {
  process.loadEnvFile(projectEnvFile);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://lintel:lintel@localhost:5432/lintel",
  },
});
