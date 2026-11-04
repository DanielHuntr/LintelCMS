import { and, asc, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { collectionsTable } from "../../collections/collections.table.js";
import { sitesTable } from "../../sites/sites.table.js";
import { siteFontsTable } from "../../site-fonts/site-fonts.table.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { dashboardLayoutsTable } from "../../dashboard/dashboard.table.js";
import { blueprintsTable } from "../../blueprints/blueprints.table.js";
import type { Database } from "../client.js";
import { isUniqueViolation } from "../database-errors.js";
import { capabilitiesOf, dialectOf } from "./database-dialect.js";
import {
  countWhere,
  daysBefore,
  idListIncludes,
  idListWithout,
  jsonAsText,
  jsonListIncludes,
  jsonText,
  jsonValue,
  likeIgnoringCase,
  orderNullsLast,
  utcDay,
} from "./expressions.js";
import { tableFor } from "./mysql-tables.js";
import {
  deleteReturning,
  insertIfNew,
  insertIfNewReturning,
  insertReturning,
  updateReturning,
  upsert,
} from "./writes.js";

const FIRST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";

function sites(database: Database) {
  return tableFor(database, sitesTable);
}

async function addSite(database: Database, handle: string) {
  const [site] = await insertReturning(database, sites(database), {
    handle,
    name: handle,
    domain: `${handle}.test`,
  });
  if (!site) throw new Error("The site was not saved.");
  return site;
}

describe("the dialect check", () => {
  it("sees a database as Postgres unless it really is MySQL", async () => {
    expect(dialectOf({} as Database)).toBe("postgres");
    expect(capabilitiesOf({} as Database).writesReturnRows).toBe(true);
  });
});

describeOnEveryDatabase("Dialect helpers", (handle) => {
  it("knows which database it is talking to, inside a transaction too", async () => {
    const expected = handle.name === "built-in" ? "postgres" : "mysql";
    expect(dialectOf(handle.database)).toBe(expected);
    await handle.database.transaction(async (transaction) => {
      expect(dialectOf(transaction)).toBe(expected);
    });
  });

  it("fills in ids, defaults, JSON, lists and times on insert", async () => {
    const before = Date.now();
    const site = await addSite(handle.database, "uk");
    expect(site.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(site.tenantId).toBe("default");
    expect(site.hostnames).toEqual([]);
    expect(site.branding).toEqual({ logoAssetId: null, accentColor: null });
    expect(site.locale).toBe("en-GB");
    expect(site.createdAt).toBeInstanceOf(Date);
    expect(Math.abs(site.createdAt.getTime() - before)).toBeLessThan(60_000);
  });

  it("returns several inserted rows in the order given, and chosen fields", async () => {
    const table = sites(handle.database);
    const rows = await insertReturning(
      handle.database,
      table,
      [
        { handle: "b", name: "B", domain: "b.test" },
        { handle: "a", name: "A", domain: "a.test" },
      ],
      { handle: table.handle },
    );
    expect(rows).toEqual([{ handle: "b" }, { handle: "a" }]);
  });

  it("keeps millisecond times, long text and awkward JSON exactly", async () => {
    const table = tableFor(handle.database, siteFontsTable);
    const site = await addSite(handle.database, "uk");
    const moment = new Date("2026-03-29T01:30:15.123Z");
    const sourceId = "x".repeat(70_000);
    const files = [
      { assetId: "123", weight: '4"00', style: "normal", format: "woff2", unicodeRange: "é✓" },
    ] as const;
    const [font] = await insertReturning(handle.database, table, {
      siteId: site.id,
      family: "Lora",
      source: "upload",
      sourceId,
      files: [...files],
      licenceConfirmedAt: moment,
    });
    expect(font?.licenceConfirmedAt?.toISOString()).toBe(moment.toISOString());
    expect(font?.sourceId).toBe(sourceId);
    expect(font?.files).toEqual(files);
  });

  it("treats text as exact in unique keys and comparisons", async () => {
    const database = handle.database;
    const table = tableFor(database, siteFontsTable);
    const site = await addSite(database, "uk");
    const add = (family: string) =>
      insertReturning(database, table, { siteId: site.id, family, source: "upload" });
    await add("Lora");
    await add("lora");
    await add("Lóra");
    await add("Lora ");
    await expect(add("Lora")).rejects.toSatisfy(isUniqueViolation);

    const exact = await database.select().from(table).where(eq(table.family, "Lora"));
    expect(exact.map((font) => font.family)).toEqual(["Lora"]);
  });

  it("updates and returns rows, even when the change stops them matching", async () => {
    const database = handle.database;
    const table = sites(database);
    const site = await addSite(database, "uk");
    const [changed] = await updateReturning(
      database,
      table,
      { handle: "gb", hostnames: ["a.test", "b.test"] },
      eq(table.handle, "uk"),
    );
    expect(changed).toMatchObject({ id: site.id, handle: "gb", hostnames: ["a.test", "b.test"] });
    expect(changed?.updatedAt.getTime()).toBeGreaterThanOrEqual(site.updatedAt.getTime());
    expect(await updateReturning(database, table, { name: "x" }, eq(table.handle, "uk"))).toEqual(
      [],
    );
  });

  it("deletes and returns rows as they were", async () => {
    const database = handle.database;
    const table = sites(database);
    await addSite(database, "uk");
    const removed = await deleteReturning(database, table, eq(table.handle, "uk"), {
      name: table.name,
    });
    expect(removed).toEqual([{ name: "uk" }]);
    expect(await database.select().from(table)).toEqual([]);
  });

  it("upserts on a key, adding then changing one row", async () => {
    const database = handle.database;
    const table = sites(database);
    const write = (name: string) =>
      upsert(
        database,
        table,
        { handle: "uk", name, domain: "uk.test" },
        { target: [table.tenantId, table.handle], set: { name } },
      );
    await write("First");
    await write("Second");
    const rows = await database.select().from(table);
    expect(rows.map((row) => row.name)).toEqual(["Second"]);
  });

  it("can work out a new value from the old one in an upsert", async () => {
    const database = handle.database;
    const table = sites(database);
    const write = () =>
      upsert(
        database,
        table,
        { handle: "uk", name: "uk", domain: "uk.test", sortOrder: 1 },
        {
          target: [table.tenantId, table.handle],
          set: { sortOrder: sql`${table.sortOrder} + ${5}` },
        },
      );
    await write();
    await write();
    const [row] = await database.select().from(table);
    expect(row?.sortOrder).toBe(6);
  });

  it("refuses an upsert that MySQL could apply to the wrong key", async () => {
    const database = handle.database;
    const table = tableFor(database, dashboardLayoutsTable);
    const write = upsert(
      database,
      table,
      { userId: null, roleId: null, widgets: [] },
      { target: [table.tenantId, table.userId], set: { widgets: [] } },
    );
    if (handle.name === "built-in") {
      await write.catch(() => {});
      return;
    }
    await expect(write).rejects.toThrow(/could also fire on/);
  });

  it("skips rows that exist, and reports only those it added", async () => {
    const database = handle.database;
    const table = sites(database);
    const row = { handle: "uk", name: "uk", domain: "uk.test" };
    const target = [table.tenantId, table.handle];
    const first = await insertIfNewReturning(database, table, row, { target });
    const second = await insertIfNewReturning(database, table, row, { target });
    await insertIfNew(database, table, row);
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
    expect(await database.select().from(table)).toHaveLength(1);
  });

  it("still fails on a clash with a different key from the one named", async () => {
    const database = handle.database;
    const table = sites(database);
    const site = await addSite(database, "uk");
    await expect(
      insertIfNewReturning(
        database,
        table,
        { id: site.id, handle: "other", name: "x", domain: "x.test" },
        { target: [table.tenantId, table.handle] },
      ),
    ).rejects.toSatisfy(isUniqueViolation);
  });

  it("carries on with a transaction after skipping a row", async () => {
    const database = handle.database;
    const table = sites(database);
    await addSite(database, "uk");
    await database.transaction(async (transaction) => {
      const row = { handle: "uk", name: "again", domain: "uk.test" };
      await insertIfNew(transaction, table, row);
      await addSite(transaction as Database, "fr");
    });
    expect(await database.select().from(table)).toHaveLength(2);
  });

  it("undoes everything when a transaction fails", async () => {
    const database = handle.database;
    await expect(
      database.transaction(async (transaction) => {
        await addSite(transaction as Database, "uk");
        throw new Error("Stop");
      }),
    ).rejects.toThrow("Stop");
    expect(await database.select().from(sites(database))).toEqual([]);
  });

  it("follows foreign keys: refuses a missing parent and cascades deletes", async () => {
    const database = handle.database;
    const fonts = tableFor(database, siteFontsTable);
    const add = (siteId: string) =>
      database.insert(fonts).values({ siteId, family: "Lora", source: "upload" });
    await expect(add(FIRST_ID)).rejects.toThrow();
    const site = await addSite(database, "uk");
    await add(site.id);
    await database.delete(sites(database)).where(eq(sites(database).id, site.id));
    expect(await database.select().from(fonts)).toEqual([]);
  });

  it("reads JSON keys as text and as JSON", async () => {
    const database = handle.database;
    const table = sites(database);
    await insertReturning(database, table, {
      handle: "uk",
      name: "uk",
      domain: "uk.test",
      branding: { logoAssetId: null, accentColor: "#123456" },
    });
    const [row] = await database
      .select({
        colour: jsonText(database, table.branding, "accentColor"),
        logo: jsonText(database, table.branding, "logoAssetId"),
        missing: jsonText(database, table.branding, "no such key"),
        value: jsonValue(database, table.branding, "accentColor"),
      })
      .from(table);
    expect(row).toMatchObject({ colour: "#123456", logo: null, missing: null });
  });

  it("finds exact words in JSON", async () => {
    const database = handle.database;
    const asJson = tableFor(database, blueprintsTable);
    await insertReturning(database, asJson, {
      handle: "page",
      name: "Page",
      kind: "entry",
      fields: [{ handle: "title", type: "text" }] as never,
    });
    const blueprints = await database
      .select({ handle: asJson.handle })
      .from(asJson)
      .where(sql`${jsonAsText(database, asJson.fields)} like ${'%"title"%'}`);
    expect(blueprints).toEqual([{ handle: "page" }]);
    const noWords = await database
      .select({ handle: asJson.handle })
      .from(asJson)
      .where(sql`${jsonAsText(database, asJson.fields)} like ${'%"TITLE"%'}`);
    expect(noWords).toEqual([]);
  });

  it("matches a like pattern whatever the case", async () => {
    const database = handle.database;
    const table = sites(database);
    await addSite(database, "Café");
    const rows = await database
      .select()
      .from(table)
      .where(likeIgnoringCase(database, table.handle, "CAF%"));
    expect(rows).toHaveLength(1);
  });

  it("counts rows matching a condition, and gives zero for none", async () => {
    const database = handle.database;
    const table = sites(database);
    const counted = () =>
      database
        .select({ named: countWhere(database, eq(table.name, "uk")) })
        .from(table)
        .then(([row]) => row?.named);
    expect(await counted()).toBe(0);
    await addSite(database, "uk");
    await addSite(database, "fr");
    expect(await counted()).toBe(1);
  });

  it("puts nulls last in either direction", async () => {
    const database = handle.database;
    const table = sites(database);
    await addSite(database, "none");
    await insertReturning(database, table, {
      handle: "b",
      name: "b",
      domain: "b.test",
      fallbackLocale: "b",
    });
    await insertReturning(database, table, {
      handle: "a",
      name: "a",
      domain: "a.test",
      fallbackLocale: "a",
    });
    const ordered = async (direction: "asc" | "desc") =>
      (
        await database
          .select({ handle: table.handle })
          .from(table)
          .orderBy(orderNullsLast(database, table.fallbackLocale, direction))
      ).map((row) => row.handle);
    expect(await ordered("asc")).toEqual(["a", "b", "none"]);
    expect(await ordered("desc")).toEqual(["b", "a", "none"]);
  });

  it("does date sums in UTC", async () => {
    const database = handle.database;
    const table = sites(database);
    const site = await addSite(database, "uk");
    await database
      .update(table)
      .set({ createdAt: new Date("2026-11-04T23:59:59.999Z"), sortOrder: 3 })
      .where(eq(table.id, site.id));
    const moment = new Date("2026-11-08T23:59:59.999Z");
    const [row] = await database
      .select({ day: utcDay(database, table.createdAt) })
      .from(table)
      .where(sql`${table.createdAt} < ${daysBefore(database, moment, table.sortOrder)}`);
    expect(row?.day).toBe("2026-11-04");
  });

  it("finds and removes an id in a list of ids", async () => {
    const database = handle.database;
    const table = tableFor(database, collectionsTable);
    const blueprints = tableFor(database, blueprintsTable);
    const [blueprint] = await insertReturning(database, blueprints, {
      handle: "page",
      name: "Page",
      kind: "entry",
    });
    await insertReturning(database, table, {
      handle: "pages",
      name: "Pages",
      blueprintId: blueprint?.id ?? "",
      siteIds: [FIRST_ID, SECOND_ID],
    });
    const hasFirst = idListIncludes(database, table.siteIds, FIRST_ID);
    expect(await database.select().from(table).where(hasFirst)).toHaveLength(1);
    await database
      .update(table)
      .set({ siteIds: idListWithout(database, table.siteIds, FIRST_ID) })
      .where(hasFirst);
    const [row] = await database.select().from(table);
    expect(row?.siteIds).toEqual([SECOND_ID]);
    expect(
      await database
        .select()
        .from(table)
        .where(and(hasFirst, eq(table.handle, "pages"))),
    ).toEqual([]);
  });

  it("looks for an item in a JSON list", async () => {
    const database = handle.database;
    const table = sites(database);
    await updateAddSiteWithHostnames(database);
    if (handle.name === "built-in") return; // A Postgres array here, not JSON.
    const rows = await database
      .select({ handle: table.handle })
      .from(table)
      .where(jsonListIncludes(database, table.hostnames, "b.test"))
      .orderBy(asc(table.handle));
    expect(rows).toEqual([{ handle: "uk" }]);
  });
});

async function updateAddSiteWithHostnames(database: Database) {
  await insertReturning(database, sites(database), {
    handle: "uk",
    name: "uk",
    domain: "a.test",
    hostnames: ["a.test", "b.test"],
  });
}
