import { existsSync, writeFileSync } from "node:fs";
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
 * LINTEL_FIRST_BASELINE=1 writes the list from nothing, and is for its first version only.
 */

const found = scanForPostgresOnlyCode();
const firstTime = process.env.LINTEL_FIRST_BASELINE === "1" && !existsSync(BASELINE_FILE);

if (!firstTime) {
  const { added } = compareWithBaseline(found, readBaseline());
  if (added.length > 0) {
    console.error(`New Postgres-only code, so the list wasn't changed:\n${added.join("\n")}`);
    process.exit(1);
  }
}

writeFileSync(BASELINE_FILE, `${JSON.stringify(found, null, 2)}\n`);
console.warn(`Postgres-only code left: ${JSON.stringify(totalsByRule(found), null, 2)}`);
