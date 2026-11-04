import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  findWorkingCopyBySlug,
  listCollectionsWithBlueprints,
  listWorkingCopies,
} from "./graphql.repository.js";

describeOnEveryDatabase("GraphQL reads", (handle) => {
  it("lists collections with their blueprints", async () => {
    const { database } = handle;
    await addTestEntry(database);
    const [collection] = await listCollectionsWithBlueprints(database, "default");
    expect(collection).toMatchObject({
      handle: "pages",
      blueprint: { handle: "page", fields: [] },
    });
  });

  it("reads working copies with their values as objects", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Home", list: [1, "two"] } });
    const page = { limit: 10, offset: 0 };
    const { collectionId, siteId, locale } = entry;
    const { rows, total } = await listWorkingCopies(
      database,
      collectionId,
      siteId,
      locale,
      true,
      page,
    );
    expect(total).toBe(1);
    expect(rows[0]?.data).toEqual({ title: "Home", list: [1, "two"] });
    const found = await findWorkingCopyBySlug(database, collectionId, siteId, locale, entry.slug);
    expect(found?.data).toEqual({ title: "Home", list: [1, "two"] });
  });
});
