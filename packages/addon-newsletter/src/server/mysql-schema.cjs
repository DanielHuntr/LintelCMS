// Each table in its MySQL form, for drizzle-kit: `pnpm db:generate:mysql --name <what_changed>`.
// CommonJS, so it can name them from `mysqlTableFor` without a second description of each.
const { mysqlTableFor } = require("@lintel/core/plugin");
const { newsletterConnectionTable } = require("./newsletter.table.ts");

module.exports = { newsletterConnectionTable: mysqlTableFor(newsletterConnectionTable) };
