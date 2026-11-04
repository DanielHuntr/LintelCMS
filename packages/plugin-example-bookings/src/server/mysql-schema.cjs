// Each table in its MySQL form, for drizzle-kit: `pnpm db:generate:mysql --name <what_changed>`.
// CommonJS, so it can name them from `mysqlTableFor` without a second description of each.
const { mysqlTableFor } = require("@lintel/core/plugin");
const { bookingsTable } = require("./bookings.table.ts");

module.exports = { bookingsTable: mysqlTableFor(bookingsTable) };
