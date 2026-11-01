import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { multipartFiles } from "../testing/multipart.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { isScheduledBackupDue, runScheduledBackupIfDue } from "./backup-schedule.service.js";
import { backupsContextFor } from "./backups.service.js";

interface BackupBody {
  id: string;
  status: string;
  trigger: string;
  filename: string;
  contents: { tables: Record<string, number> } | null;
}

describe("Settings → Backups", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);

  async function makeBackup(): Promise<BackupBody> {
    const started = await tools.api("POST", "/backups");
    expect(started.statusCode).toBe(202);
    expect(started.json<BackupBody>().status).toBe("running");
    await tools.server.dataTools.tasks.finishAll();
    const { backups } = (await tools.api("GET", "/backups")).json<{ backups: BackupBody[] }>();
    const made = backups.find((backup) => backup.id === started.json<BackupBody>().id);
    if (!made) throw new Error("The backup isn't in the list");
    return made;
  }

  it("makes a backup in the background and lists it with what it holds", async () => {
    await tools.api("POST", "/collections/pages/entries", { data: { title: "About" } });

    const backup = await makeBackup();

    expect(backup).toMatchObject({ status: "complete", trigger: "manual" });
    expect(backup.contents?.tables.entries).toBe(1);
    const download = await tools.api("GET", `/backups/${backup.id}/download`);
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toBe("application/zip");
    expect(download.rawPayload.subarray(0, 2).toString()).toBe("PK");
  });

  it("restores only when confirmed, after backing up the site as it is now", async () => {
    await tools.api("POST", "/collections/pages/entries", { data: { title: "About" } });
    const backup = await makeBackup();
    await tools.api("POST", "/collections/pages/entries", { data: { title: "Added later" } });

    const preview = (await tools.api("GET", `/backups/${backup.id}/restore-preview`)).json<{
      tables: Array<{ table: string; inBackup: number; current: number }>;
    }>();
    expect(preview.tables.find((table) => table.table === "entries")).toMatchObject({
      inBackup: 1,
      current: 2,
    });

    const unconfirmed = await tools.api("POST", `/backups/${backup.id}/restore`, {});
    expect(unconfirmed.statusCode).toBe(400);

    const restored = await tools.api("POST", `/backups/${backup.id}/restore`, {
      confirm: "RESTORE",
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().safetyBackupId).toEqual(expect.any(String));

    const api = await tools.signInAgain();
    const pages = (await api("GET", "/collections/pages/entries")).json<{
      entries: Array<{ title: string }>;
    }>();
    expect(pages.entries.map((entry) => entry.title)).toEqual(["About"]);
    const { backups } = (await api("GET", "/backups")).json<{ backups: BackupBody[] }>();
    expect(backups.map((item) => item.trigger).sort()).toEqual(["before-restore", "manual"]);
  });

  it("takes an uploaded backup, and refuses a file that isn't one", async () => {
    const backup = await makeBackup();
    const archive = await readFile(`${tools.folder}/backups/${backup.filename}`);

    const upload = (contents: Buffer) =>
      tools.server.inject({
        method: "POST",
        url: "/backups/upload",
        cookies: tools.cookies,
        ...multipartFiles([{ fieldName: "file", filename: "site.zip", contents }]),
      });

    const accepted = await upload(archive);
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json<BackupBody>()).toMatchObject({ trigger: "uploaded", status: "complete" });

    const refused = await upload(Buffer.from("not a backup"));
    expect(refused.statusCode).toBe(400);
    expect(refused.json().code).toBe("UNREADABLE_ARCHIVE");
  });

  it("makes scheduled backups when due and keeps only the newest few", async () => {
    const saved = await tools.api("PUT", "/backups/schedule", { frequency: "daily", keep: 2 });
    expect(saved.json()).toEqual({ frequency: "daily", keep: 2 });
    const context = backupsContextFor(tools.server);
    const day = 24 * 60 * 60 * 1000;

    expect(await runScheduledBackupIfDue(context, new Date())).toBe(true);
    expect(await runScheduledBackupIfDue(context, new Date())).toBe(false);
    expect(await runScheduledBackupIfDue(context, new Date(Date.now() + day))).toBe(true);
    expect(await runScheduledBackupIfDue(context, new Date(Date.now() + 2 * day))).toBe(true);

    const { backups } = (await tools.api("GET", "/backups")).json<{ backups: BackupBody[] }>();
    expect(backups.filter((backup) => backup.trigger === "scheduled")).toHaveLength(2);
  });

  it("only lets people with backups:manage make or restore backups", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [
      ["entries:*", "backups:read"],
    ]);
    const editor = requestsAs(
      tools.server,
      await signInAndGetCookies(tools.server, "editor@example.com"),
    );

    expect((await editor("GET", "/backups")).statusCode).toBe(200);
    expect((await editor("POST", "/backups")).statusCode).toBe(403);
    expect(
      (await editor("PUT", "/backups/schedule", { frequency: "daily", keep: 3 })).statusCode,
    ).toBe(403);
  });
});

describe("when a scheduled backup is due", () => {
  const now = new Date("2026-11-01T09:00:00Z");
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

  it("is never when backups are off, and straight away when there are none yet", () => {
    expect(isScheduledBackupDue("off", undefined, now)).toBe(false);
    expect(isScheduledBackupDue("daily", undefined, now)).toBe(true);
  });

  it("is a day (or a week) after the last one, give or take a few minutes", () => {
    expect(isScheduledBackupDue("daily", hoursAgo(23), now)).toBe(false);
    expect(isScheduledBackupDue("daily", hoursAgo(23.9), now)).toBe(true);
    expect(isScheduledBackupDue("weekly", hoursAgo(24 * 6), now)).toBe(false);
    expect(isScheduledBackupDue("weekly", hoursAgo(24 * 7), now)).toBe(true);
  });
});
