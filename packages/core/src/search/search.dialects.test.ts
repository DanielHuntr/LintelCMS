import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { insertAsset } from "../media/media.repository.js";
import type { NewAssetRow } from "../media/media.table.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import { searchAssets } from "./search.repository.js";

const EARLIER = new Date("2026-06-01T11:59:00.123Z");
const NOW = new Date("2026-06-01T12:00:00.123Z");
const LATER = new Date("2026-06-01T12:01:00.123Z");

function addAsset(database: Database, filename: string, values: Partial<NewAssetRow> = {}) {
  return insertAsset(database, {
    filename,
    storageKey: randomUUID(),
    mimeType: "image/png",
    size: 100,
    contentHash: randomUUID(),
    ...values,
  });
}

describeOnEveryDatabase("Searching files", (handle) => {
  const search = async (words: string[], limit = 10) => {
    const rows = await searchAssets(handle.database, DEFAULT_TENANT_ID, { words, limit });
    return rows.map((row) => row.filename);
  };

  it("finds a word in the file name or the alt text, whatever the case", async () => {
    const { database } = handle;
    await addAsset(database, "Harbour.png");
    await addAsset(database, "photo.png", { alt: "The old HARBOUR wall" });
    await addAsset(database, "bread.png", { alt: "Fresh loaf" });

    expect((await search(["harbour"])).sort()).toEqual(["Harbour.png", "photo.png"]);
    expect(await search(["BREAD"])).toEqual(["bread.png"]);
    expect(await search(["oaf"])).toEqual(["bread.png"]);
    expect(await search(["nothing"])).toEqual([]);
  });

  it("finds words past plain English letters", async () => {
    const { database } = handle;
    await addAsset(database, "été-zoë.png");
    await addAsset(database, "ete-zoe.png");
    await addAsset(database, "sunny.png", { alt: "Привет 😀" });
    expect(await search(["été"])).toEqual(["été-zoë.png"]);
    expect(await search(["ÉTÉ"])).toEqual(["été-zoë.png"]);
    expect(await search(["привет"])).toEqual(["sunny.png"]);
    expect(await search(["Привет"])).toEqual(["sunny.png"]);
    expect(await search(["😀"])).toEqual(["sunny.png"]);
  });

  it("gives back the whole row", async () => {
    const { database } = handle;
    const saved = await addAsset(database, "a.png", { width: 10, height: 20, focalX: 0.25 });
    const [found] = await searchAssets(database, DEFAULT_TENANT_ID, {
      words: ["a.png"],
      limit: 1,
    });
    expect(found).toEqual(saved);
  });

  it("needs every word, in either place", async () => {
    const { database } = handle;
    await addAsset(database, "harbour.png", { alt: "At dawn" });
    await addAsset(database, "harbour-dawn.png");
    await addAsset(database, "harbour-dusk.png");
    expect((await search(["harbour", "dawn"])).sort()).toEqual(["harbour-dawn.png", "harbour.png"]);
  });

  it("takes %, _ and \\ as themselves", async () => {
    const { database } = handle;
    await addAsset(database, "50%-off.png");
    await addAsset(database, "my_file.png");
    await addAsset(database, "myxfile.png");
    await addAsset(database, "back\\slash.png");
    expect(await search(["%"])).toEqual(["50%-off.png"]);
    expect(await search(["y_f"])).toEqual(["my_file.png"]);
    expect(await search(["k\\s"])).toEqual(["back\\slash.png"]);
  });

  it("puts the newest first, the id settling a tie, up to the limit", async () => {
    const { database } = handle;
    const [lowerId, higherId] = [randomUUID(), randomUUID()].sort();
    await addAsset(database, "oldest.png", { createdAt: EARLIER });
    await addAsset(database, "tied-lower.png", { id: lowerId, createdAt: NOW });
    await addAsset(database, "tied-higher.png", { id: higherId, createdAt: NOW });
    await addAsset(database, "newest.png", { createdAt: LATER });

    expect(await search(["png"])).toEqual([
      "newest.png",
      "tied-higher.png",
      "tied-lower.png",
      "oldest.png",
    ]);
    expect(await search(["png"], 2)).toEqual(["newest.png", "tied-higher.png"]);
  });

  it("gives every file when there are no words", async () => {
    const { database } = handle;
    await addAsset(database, "a.png");
    await addAsset(database, "b.pdf", { mimeType: "application/pdf" });
    expect((await search([])).sort()).toEqual(["a.png", "b.pdf"]);
  });

  it("stays within its tenant", async () => {
    const { database } = handle;
    await addAsset(database, "ours.png");
    await addAsset(database, "theirs.png", { tenantId: "other" });
    expect(await search(["png"])).toEqual(["ours.png"]);
    const theirs = await searchAssets(database, "other", { words: ["png"], limit: 10 });
    expect(theirs.map((row) => row.filename)).toEqual(["theirs.png"]);
  });
});
