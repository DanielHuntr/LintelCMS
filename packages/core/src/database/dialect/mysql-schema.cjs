// Every table in MySQL's form, for drizzle-kit, which wants one export per table.
// CommonJS, because the list comes from schema.ts and an ES module can't export a list.
const { is } = require("drizzle-orm");
const { PgTable } = require("drizzle-orm/pg-core");
const schema = require("../schema.ts");
const { mysqlTableFor } = require("./mysql-tables.ts");

module.exports = Object.fromEntries(
  Object.entries(schema)
    .filter(([, value]) => is(value, PgTable))
    .map(([name, table]) => [name, mysqlTableFor(table)]),
);
