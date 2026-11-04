import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteFieldsetRow,
  findFieldsetByHandle,
  insertFieldsetIfMissing,
  listFieldsetRows,
  updateFieldsetRow,
} from "./fieldsets.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Fieldsets", (handle) => {
  it("adds a fieldset once, changes it and deletes it", async () => {
    const { database } = handle;
    const added = await insertFieldsetIfMissing(database, { handle: "seo", name: "SEO" });
    expect(added?.fields).toEqual([]);
    expect(await insertFieldsetIfMissing(database, { handle: "seo", name: "Again" })).toBe(
      undefined,
    );
    await updateFieldsetRow(database, added?.id ?? "", { name: "Search", fields: [] });
    expect((await findFieldsetByHandle(database, TENANT, "seo"))?.name).toBe("Search");
    expect(await listFieldsetRows(database, TENANT)).toHaveLength(1);
    await deleteFieldsetRow(database, added?.id ?? "");
    expect(await listFieldsetRows(database, TENANT)).toEqual([]);
  });
});
