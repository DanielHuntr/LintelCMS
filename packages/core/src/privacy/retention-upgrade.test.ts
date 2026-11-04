import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withPrivacyChoice } from "../backups/backup-archive.service.js";
import { testsRunOnMysql, useTestDatabase } from "../testing/test-database.js";
import { securityEventsTable } from "../security-log/security-events.table.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { usePrivacyTestServer } from "./privacy-test-server.js";
import {
  defaultPrivacySettings,
  defaultRetentionRules,
  heldPrivacySettings,
} from "./privacy.schema.js";
import { runRetentionRules } from "./retention.service.js";

const DAY = 24 * 60 * 60_000;

// That migration is Postgres's. A MySQL install is never older than it, so has none to run.
const itAfterUpgrade = it.skipIf(testsRunOnMysql);

const migration = readFileSync(
  new URL("../../migrations/0037_hold_retention_on_upgrades.sql", import.meta.url),
  "utf8",
);

/** An upgraded site never loses anything to a rule its owner didn't choose. */
describe("retention rules after an upgrade", () => {
  const testDatabase = useTestDatabase();
  const privacy = usePrivacyTestServer(testDatabase);

  const run = () =>
    runRetentionRules({ database: testDatabase.database, forms: privacy.server.forms.context });
  const upgrade = () => testDatabase.database.execute(sql.raw(migration));
  const oldLogEntry = () =>
    testDatabase.database.insert(securityEventsTable).values({
      kind: "sign-in",
      actorEmail: "a@example.com",
      createdAt: new Date(Date.now() - 200 * DAY),
    });
  const logEntries = async () =>
    (await testDatabase.database.select().from(securityEventsTable)).filter(
      (row) => row.actorEmail === "a@example.com",
    );

  it("gives a new install the usual defaults", async () => {
    await oldLogEntry();
    const settings = await readSetting(testDatabase.database, "privacy");
    expect(settings.retention).toEqual(defaultRetentionRules);
    const answer = (await privacy.api("GET", "/privacy/retention")).json();
    expect(answer.needsChoice).toBe(false);
    await run();
    expect(await logEntries()).toEqual([]);
  });

  itAfterUpgrade(
    "deletes nothing on an upgraded install, and says a choice is waiting",
    async () => {
      await upgrade();
      await oldLogEntry();

      await run();

      expect(await logEntries()).toHaveLength(1);
      const answer = (await privacy.api("GET", "/privacy/retention")).json();
      expect(answer.needsChoice).toBe(true);
      expect(answer.rules.map((rule: { enabled: boolean }) => rule.enabled)).toEqual([
        false,
        false,
        false,
        false,
      ]);
    },
  );

  itAfterUpgrade("applies a rule once the owner turns it on, and the notice goes", async () => {
    await upgrade();
    await oldLogEntry();

    const answer = await privacy.api("PUT", "/privacy/retention", {
      activityLogs: { enabled: true, days: 90 },
    });
    expect(answer.json().needsChoice).toBe(false);

    await run();
    expect(await logEntries()).toEqual([]);
  });

  itAfterUpgrade("lets the owner keep them all off", async () => {
    await upgrade();
    const answer = await privacy.api("PUT", "/privacy/retention", {});
    expect(answer.json().needsChoice).toBe(false);
    expect(
      (await readSetting(testDatabase.database, "privacy")).retention.activityLogs.enabled,
    ).toBe(false);
  });

  it("treats a backup from before the rules the same way", () => {
    expect(withPrivacyChoice({ siteName: "Old" })).toEqual({
      siteName: "Old",
      privacy: heldPrivacySettings,
    });
    const chosen = { privacy: defaultPrivacySettings };
    expect(withPrivacyChoice(chosen)).toBe(chosen);
  });

  itAfterUpgrade("leaves a choice already saved alone", async () => {
    const chosen = {
      retention: { ...defaultRetentionRules, orders: { enabled: true, days: 3650 } },
      processors: [],
      retentionNeedsChoice: false,
    };
    await writeSetting(testDatabase.database, "privacy", chosen);
    await upgrade();
    const settings = await readSetting(testDatabase.database, "privacy");
    expect(settings.retention.orders).toEqual({ enabled: true, days: 3650 });
    expect(settings.retentionNeedsChoice).toBe(false);
  });
});
