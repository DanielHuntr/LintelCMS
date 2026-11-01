import { defineConfig } from "drizzle-kit";

// `pnpm db:generate --name <what_changed>` compares the plugin's table with its migrations
// folder. Lintel applies the migrations itself when the server starts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/bookings.table.ts",
  out: "./migrations",
});
