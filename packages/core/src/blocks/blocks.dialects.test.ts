import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteBlockRow,
  findBlockRow,
  insertBlockIfMissing,
  listBlockRows,
  listCollectionFields,
  listEntriesMentioning,
  updateBlockRow,
  updateEntryValues,
} from "./blocks.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Blocks", (handle) => {
  it("adds a block once, changes it and deletes it", async () => {
    const { database } = handle;
    const block = await insertBlockIfMissing(database, { handle: "hero", name: "Hero" });
    expect(block?.variants).toEqual({ properties: [], looks: [], clientsMayChoose: false });
    expect(await insertBlockIfMissing(database, { handle: "hero", name: "x" })).toBeUndefined();
    await updateBlockRow(database, block?.id ?? "", { name: "Banner" });
    expect((await findBlockRow(database, TENANT, "hero"))?.name).toBe("Banner");
    expect(await listBlockRows(database, TENANT)).toHaveLength(1);
    await deleteBlockRow(database, block?.id ?? "");
    expect(await listBlockRows(database, TENANT)).toEqual([]);
  });

  it("finds entries that mention a block in either copy", async () => {
    const { database } = handle;
    const draft = await addTestEntry(database, {
      slug: "draft",
      data: { title: "Draft", blocks: [{ block: "hero" }] },
    });
    const live = await addTestEntry(database, {
      slug: "live",
      publishedData: { blocks: [{ block: "hero" }] },
    });
    await addTestEntry(database, { slug: "plain", data: { title: "hero" } });

    const spaced = await listEntriesMentioning(database, TENANT, '"hero"');
    expect(spaced.map((row) => row.id)).toContain(draft.id);
    expect(spaced.map((row) => row.id)).toContain(live.id);
    expect(spaced.find((row) => row.id === draft.id)?.title).toBe("Draft");
  });

  it("writes an entry's values back, and lists collections' fields", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    await updateEntryValues(database, entry.id, { data: { a: 1 }, publishedData: null });
    const mentioned = await listEntriesMentioning(database, TENANT, '"a"');
    expect(mentioned[0]?.data).toEqual({ a: 1 });
    expect(await listCollectionFields(database, TENANT)).toEqual([{ handle: "pages", fields: [] }]);
  });
});
