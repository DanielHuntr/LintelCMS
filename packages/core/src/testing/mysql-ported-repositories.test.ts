import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mysqlPortedRepositories } from "./mysql-ported-repositories.js";
import { dialectTestsBeside, portingReport, readRepository } from "./mysql-porting-report.js";
import { SOURCE_FOLDER, readBaseline } from "./postgres-only-code.js";

describe.each(mysqlPortedRepositories)("%s, moved to MySQL", (file) => {
  const facts = readRepository(join(SOURCE_FOLDER, file));

  it("has no Postgres-only code left", () => {
    expect(readBaseline()[file]).toBeUndefined();
  });

  it("gets every table through tableFor", () => {
    expect(facts.directTableUses).toEqual([]);
  });

  it("runs every exported function in a dialect test", () => {
    const tests = dialectTestsBeside(file);
    const untested = facts.exportedFunctions.filter((name) => !tests.includes(name));
    expect(untested).toEqual([]);
  });
});

describe("the porting report", () => {
  it("counts moved work against all of it", () => {
    const report = portingReport();
    expect(report.repositories.ported).toBe(mysqlPortedRepositories.length);
    expect(report.queries.ported).toBeLessThanOrEqual(report.queries.total);
    expect(report.tables.finished.length).toBeLessThanOrEqual(report.tables.reached.length);
  });
});
