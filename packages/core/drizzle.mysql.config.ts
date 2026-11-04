import { defineConfig } from "drizzle-kit";

// The MySQL and MariaDB migrations, worked out from the same tables as the Postgres ones
// (see src/database/dialect/README.md) and kept in their own folder. Generated with
// `pnpm db:generate:mysql --name <what_changed>`. `pnpm db:generate` is not affected.
export default defineConfig({
  dialect: "mysql",
  schema: "./src/database/dialect/mysql-schema.cjs",
  out: "./migrations-mysql",
});
