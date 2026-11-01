import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yazl from "yazl";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { makeTestPng, useMediaTestServer } from "../testing/test-media.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import {
  type BackupArchiveContext,
  inspectBackupArchive,
  restoreBackupArchive,
  writeBackupArchive,
} from "./backup-archive.service.js";

describe("backup archives", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);
  let folder: string;
  let context: BackupArchiveContext;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-backup-"));
    await ensurePagesCollection(testDatabase.database);
    context = {
      database: testDatabase.database,
      databaseKind: "built-in",
      storage: new LocalDiskStorage(media.uploadsFolder),
    };
  });

  afterEach(() => rm(folder, { recursive: true, force: true }));

  async function addPageTree() {
    const api = requestsAs(media.server, media.adminCookies);
    const about = (
      await api("POST", "/collections/pages/entries", { data: { title: "About" } })
    ).json<{ id: string }>();
    await api("POST", "/collections/pages/entries", {
      data: { title: "Our team" },
      parentId: about.id,
    });
    const image = (await media.upload("logo.png", await makeTestPng())).json<{ id: string }>();
    return { api, aboutId: about.id, imageId: image.id };
  }

  it("puts the database, settings and files back exactly as they were", async () => {
    const { api, aboutId, imageId } = await addPageTree();
    await writeSetting(testDatabase.database, "siteType", "business");
    const path = join(folder, "site.zip");

    const written = await writeBackupArchive(context, path);
    expect(written.contents.tables.entries).toBe(2);
    expect(written.contents.mediaFiles).toBe(1);

    await api("DELETE", `/media/${imageId}`);
    await api("POST", "/collections/pages/entries", { data: { title: "Added later" } });
    await writeSetting(testDatabase.database, "siteType", "shop");

    const summary = await restoreBackupArchive(context, path);
    expect(summary.tables.find((table) => table.table === "entries")).toEqual({
      table: "entries",
      inBackup: 2,
      current: 3,
    });

    // Restoring signs everyone out; the restored admin signs in again.
    const signedInAgain = requestsAs(
      media.server,
      await signInAndGetCookies(media.server, "admin@example.com"),
    );
    const pages = (await signedInAgain("GET", "/collections/pages/entries")).json<{
      entries: Array<{ title: string; parentId: string | null }>;
    }>();
    expect(pages.entries.map((entry) => entry.title).sort()).toEqual(["About", "Our team"]);
    expect(pages.entries.find((entry) => entry.title === "Our team")?.parentId).toBe(aboutId);
    expect(await readSetting(testDatabase.database, "siteType")).toBe("business");
    expect((await media.server.inject({ url: `/media/${imageId}/file` })).statusCode).toBe(200);
  });

  it("says what a restore would replace without changing anything", async () => {
    await addPageTree();
    const path = join(folder, "site.zip");
    await writeBackupArchive(context, path);

    const summary = await inspectBackupArchive(context, path);

    expect(summary.tables.find((table) => table.table === "assets")).toMatchObject({
      inBackup: 1,
      current: 1,
    });
  });

  it("refuses an archive whose files don't match its manifest", async () => {
    await addPageTree();
    const path = join(folder, "site.zip");
    await writeBackupArchive(context, path);
    const tampered = join(folder, "tampered.zip");
    await copyWithChangedFile(path, tampered, "database/entries.json", "[]\n");

    await expect(restoreBackupArchive(context, tampered)).rejects.toThrow(/damaged/);
  });

  it("refuses a file that isn't a backup at all", async () => {
    const path = join(folder, "notes.zip");
    await copyWithChangedFile(undefined, path, "notes.txt", "hello");
    await expect(inspectBackupArchive(context, path)).rejects.toThrow(/isn't a Lintel backup/);

    const notZip = join(folder, "photo.zip");
    await writeFile(notZip, "not a zip");
    await expect(inspectBackupArchive(context, notZip)).rejects.toThrow(/can't be opened/);
  });
});

/** Copies an archive, replacing (or adding) one file, to stand in for a damaged download. */
async function copyWithChangedFile(
  source: string | undefined,
  target: string,
  changedPath: string,
  contents: string,
) {
  const zip = new yazl.ZipFile();
  if (source) {
    const reader = await ZipArchiveReader.open(source);
    for (const name of reader.listNames()) {
      if (name !== changedPath) {
        zip.addBuffer(await reader.readBuffer(name), name);
      }
    }
    reader.close();
  }
  zip.addBuffer(Buffer.from(contents), changedPath);
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(target));
}
