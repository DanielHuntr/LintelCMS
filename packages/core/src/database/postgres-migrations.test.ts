import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "./client.js";
import { connectToPostgres } from "./postgres-database.js";

/**
 * Migrations on a real Postgres server, run by `pnpm test:postgres`: on an empty database,
 * and on one stopped at an older migration with rows in it, as a live site would be.
 */

const freshUrl = process.env.TEST_FRESH_POSTGRES_URL;
const upgradedUrl = process.env.TEST_UPGRADED_POSTGRES_URL;

/** The last migration the older database has. */
const STOPPED_AT = 31;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FORM_ID = "22222222-2222-4222-8222-222222222222";

interface Journal {
  entries: { idx: number }[];
}

/** A copy of the migrations folder that ends at `lastIndex`. */
async function migrationsUpTo(lastIndex: number): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "lintel-migrations-"));
  await cp(MIGRATIONS_FOLDER, folder, { recursive: true });
  const journalFile = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalFile, "utf8")) as Journal;
  journal.entries = journal.entries.filter((entry) => entry.idx <= lastIndex);
  await writeFile(journalFile, JSON.stringify(journal));
  return folder;
}

/** Rows in the tables that later migrations change. */
async function addRowsToOlderDatabase(sql: postgres.Sql): Promise<void> {
  await sql`insert into users (id, email, name) values (${USER_ID}, 'ada@example.com', 'Ada')`;
  await sql`insert into webhooks (name, url, events, secret)
    values ('Build', 'https://example.com', '["entry.published"]', 'secret')`;
  await sql`insert into blocks (handle, name) values ('hero', 'Hero')`;
  await sql`insert into forms (id, handle, name, fields, submit_label, confirmation, notifications)
    values (${FORM_ID}, 'contact', 'Contact', '[]', 'Send', '{}', '{}')`;
  await sql`insert into form_submissions (form_id, values) values (${FORM_ID}, '{"a": 1}')`;
  await sql`insert into shop_settings (tenant_id) values ('default')`;
  await sql`insert into shop_orders (number, name, checkout_id, email, currency, shipping_address,
      shipping_line, subtotal_amount, discount_amount, shipping_amount, tax_amount, total_amount,
      taxes_included, paid_at)
    values (1001, '#1001', ${FORM_ID}, 'ada@example.com', 'GBP', '{}', '{}', 100, 0, 0, 0, 100,
      true, now())`;
}

function describeTables(sql: postgres.Sql) {
  return sql`
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns where table_schema = 'public'
    order by table_name, column_name`;
}

function describeKeys(sql: postgres.Sql) {
  return sql`
    select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'
    order by tablename, indexname`;
}

describe.runIf(freshUrl && upgradedUrl)("Postgres migrations", () => {
  let fresh: postgres.Sql;
  let upgraded: postgres.Sql;

  beforeAll(async () => {
    fresh = postgres(freshUrl ?? "", { onnotice: () => {} });
    upgraded = postgres(upgradedUrl ?? "", { onnotice: () => {} });

    const older = await migrationsUpTo(STOPPED_AT);
    await migrate(drizzle(upgraded), { migrationsFolder: older });
    await rm(older, { recursive: true, force: true });
    await addRowsToOlderDatabase(upgraded);

    const openedFresh = connectToPostgres(freshUrl ?? "");
    await openedFresh.applyMigrations();
    await openedFresh.close();
    const openedUpgraded = connectToPostgres(upgradedUrl ?? "");
    await openedUpgraded.applyMigrations();
    await openedUpgraded.close();
  });

  afterAll(async () => {
    await fresh?.end();
    await upgraded?.end();
  });

  it("applies every migration on an empty database", async () => {
    const journal = JSON.parse(
      await readFile(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
    ) as Journal;
    const [row] = await fresh`select count(*)::int as count from drizzle.__drizzle_migrations`;
    expect(row?.count).toBe(journal.entries.length);
  });

  it("brings an older database to exactly the same tables and keys", async () => {
    expect(await describeTables(upgraded)).toEqual(await describeTables(fresh));
    expect(await describeKeys(upgraded)).toEqual(await describeKeys(fresh));
  });

  it("keeps the rows, filling new columns with their defaults", async () => {
    const [webhook] = await upgraded`select app_id, events from webhooks`;
    expect(webhook).toEqual({ app_id: null, events: ["entry.published"] });

    const [block] = await upgraded`select variants from blocks`;
    expect(block?.variants).toEqual({ properties: [], looks: [], clientsMayChoose: false });

    const [submission] = await upgraded`select values, consents from form_submissions`;
    expect(submission).toEqual({ values: { a: 1 }, consents: [] });

    const [order] = await upgraded`select is_test from shop_orders`;
    expect(order?.is_test).toBe(false);

    const [settings] = await upgraded`select stripe_last_webhook_at from shop_settings`;
    expect(settings?.stripe_last_webhook_at).toBeNull();

    const [user] = await upgraded`select email from users where id = ${USER_ID}`;
    expect(user?.email).toBe("ada@example.com");
  });

  it("does nothing when run again", async () => {
    const before = await upgraded`select count(*)::int as count from drizzle.__drizzle_migrations`;
    const opened = connectToPostgres(upgradedUrl ?? "");
    await opened.applyMigrations();
    await opened.close();
    const after = await upgraded`select count(*)::int as count from drizzle.__drizzle_migrations`;
    expect(after).toEqual(before);
  });
});
