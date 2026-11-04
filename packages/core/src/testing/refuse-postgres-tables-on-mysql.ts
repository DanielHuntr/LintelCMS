import { refusePostgresTablesOnMysql } from "../database/dialect/refuse-postgres-tables.js";

/** While the whole suite runs on MySQL (a vitest setup file). */
refusePostgresTablesOnMysql();
