// Each table in its MySQL form, for drizzle-kit: `pnpm db:generate:mysql --name <what_changed>`.
// CommonJS, so it can name them from `mysqlTableFor` without a second description of each.
const { mysqlTableFor } = require("@lintel/core/plugin");
const { instagramAccountTable, instagramPostsTable } = require("./instagram.table.ts");

module.exports = {
  instagramAccountTable: mysqlTableFor(instagramAccountTable),
  instagramPostsTable: mysqlTableFor(instagramPostsTable),
};
