import { portingReport } from "./mysql-porting-report.js";

/** `pnpm dialect:report`: how much of Lintel runs on MySQL and MariaDB so far. */
const report = portingReport();

console.warn(`Repositories moved: ${report.repositories.ported} of ${report.repositories.total}`);
console.warn(`Queries moved: ${report.queries.ported} of ${report.queries.total}`);
console.warn(`Tables in use by a moved repository: ${report.tables.reached.length}`);
console.warn(
  `Tables used only by moved repositories: ${report.tables.finished.length} of ${report.tables.total}`,
);
console.warn(`  ${report.tables.finished.join(", ")}`);
