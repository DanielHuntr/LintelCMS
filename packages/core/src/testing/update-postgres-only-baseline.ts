import { writeFileSync } from "node:fs";
import {
  BASELINE_FILE,
  compareWithBaseline,
  readBaseline,
  scanForPostgresOnlyCode,
  totalsByRule,
} from "./postgres-only-code.js";

/**
 * `pnpm dialect:baseline`: shrinks the list of Postgres-only code after some of it has gone.
 * It refuses to grow the list: new Postgres-only code should use `src/database/dialect`.
 */

const found = scanForPostgresOnlyCode();
const { added } = compareWithBaseline(found, readBaseline());
if (added.length > 0) {
  console.error(`New Postgres-only code, so the list wasn't changed:\n${added.join("\n")}`);
  process.exit(1);
}

writeFileSync(BASELINE_FILE, `${JSON.stringify(found, null, 2)}\n`);
console.warn(`Postgres-only code left: ${JSON.stringify(totalsByRule(found), null, 2)}`);
