import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mysqlPortedRepositories,
  repositoriesRunByTheWholeSuite,
} from "./mysql-ported-repositories.js";
import { dialectTestsBeside, portingReport, readRepository } from "./mysql-porting-report.js";
import { SOURCE_FOLDER, readBaseline } from "./postgres-only-code.js";

/** The Postgres branch of a backup stays beside the call to MySQL's own, on purpose. */
const KEEPS_ITS_POSTGRES_BRANCH = ["backups/database-snapshot.repository.ts"];

/** Describes its tables once at the top, and swaps each with `tableFor` and `columnFor` in use. */
const DESCRIBES_ITS_TABLES = ["privacy/retention.repository.ts"];

describe.each([...mysqlPortedRepositories, ...repositoriesRunByTheWholeSuite])(
  "%s, moved to MySQL",
  (file) => {
    const facts = readRepository(join(SOURCE_FOLDER, file));

    it.skipIf(KEEPS_ITS_POSTGRES_BRANCH.includes(file))("has no Postgres-only code left", () => {
      expect(readBaseline()[file]).toBeUndefined();
    });

    it.skipIf(DESCRIBES_ITS_TABLES.includes(file))("gets every table through tableFor", () => {
      expect(facts.directTableUses).toEqual([]);
    });
  },
);

describe.each(mysqlPortedRepositories)("%s, with a dialect test", (file) => {
  const facts = readRepository(join(SOURCE_FOLDER, file));

  it("runs every exported function in a dialect test", () => {
    const tests = dialectTestsBeside(file);
    const untested = facts.exportedFunctions.filter((name) => !tests.includes(name));
    expect(untested).toEqual([]);
  });
});

describe("the porting report", () => {
  it("counts moved work against all of it", () => {
    const report = portingReport();
    expect(report.repositories.ported).toBe(
      mysqlPortedRepositories.length + repositoriesRunByTheWholeSuite.length,
    );
    expect(report.queries.ported).toBeLessThanOrEqual(report.queries.total);
    expect(report.tables.finished.length).toBeLessThanOrEqual(report.tables.reached.length);
  });
});
