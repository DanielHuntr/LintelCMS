import { defineConfig } from "drizzle-kit";

// The add-on's MySQL and MariaDB migrations, worked out from the same tables as the Postgres
// ones. Run `pnpm db:generate:mysql --name <what_changed>` after `pnpm db:generate`.
export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/mysql-schema.cjs",
  out: "./migrations-mysql",
});
