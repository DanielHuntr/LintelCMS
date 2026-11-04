import { describe, expect, it } from "vitest";
import {
  compareWithBaseline,
  postgresOnlyCodeIn,
  readBaseline,
  scanForPostgresOnlyCode,
} from "./postgres-only-code.js";

describe("Postgres-only code", () => {
  it("doesn't grow, and the list of what's left only shrinks", () => {
    const { added, removed } = compareWithBaseline(scanForPostgresOnlyCode(), readBaseline());

    expect(
      added,
      "This is new code only Postgres can run. Use the helpers in src/database/dialect " +
        "(its README lists them) so Lintel can run on MySQL and MariaDB too.",
    ).toEqual([]);
    expect(
      removed,
      "Good news: this code has gone. Run `pnpm --filter @lintel/core dialect:baseline` " +
        "to shrink the list, so it can't come back.",
    ).toEqual([]);
  });

  it("reads code, not comments or ordinary strings", () => {
    const found = postgresOnlyCodeIn(
      "example.repository.ts",
      `// .returning() and data->>'title'
       const text = "::uuid";
       await database.insert(table).values(row).returning();
       const title = sql\`\${table.data}->>'title'\`;
       const id = sql\`\${value}::uuid\`;`,
    );
    expect(found).toEqual({ returning: 1, "json field access": 1, "cast with ::": 1 });
  });

  it("sees each kind of Postgres-only code", () => {
    const found = postgresOnlyCodeIn(
      "example.repository.ts",
      `import { eq, ilike } from "drizzle-orm";
       import { alias } from "drizzle-orm/pg-core";
       query.onConflictDoNothing();
       query.onConflictDoUpdate({});
       database.selectDistinctOn([]);
       sql\`count(*) filter (where \${a})\`;
       sql\`jsonb_set(\${a})\`;
       sql\`\${a} @> \${b}\`;
       sql\`select pg_advisory_xact_lock(1)\`;
       sql\`\${a} desc nulls last\`;
       sql\`to_char(\${a}, 'YYYY')\`;
       sql\`\${a} = any(\${b})\`;`,
    );
    expect(found).toMatchObject({
      ilike: 1,
      "pg-core import": 1,
      upsert: 2,
      "distinct on": 1,
      "filter clause": 1,
      "jsonb function": 1,
      "json containment": 1,
      "advisory lock": 1,
      "nulls ordering": 1,
      "date function": 1,
      "array function": 1,
    });
  });

  it("allows Postgres types in table files", () => {
    const found = postgresOnlyCodeIn(
      "sites.table.ts",
      `import { pgTable } from "drizzle-orm/pg-core";`,
    );
    expect(found).toEqual({});
  });

  it("reports both new code and code that has gone", () => {
    const difference = compareWithBaseline(
      { "a.ts": { returning: 2 }, "new.ts": { ilike: 1 } },
      { "a.ts": { returning: 1 }, "gone.ts": { upsert: 3 } },
    );
    expect(difference.added).toEqual(["a.ts: returning (1 -> 2)", "new.ts: ilike (0 -> 1)"]);
    expect(difference.removed).toEqual(["gone.ts: upsert (3 -> 0)"]);
  });
});
