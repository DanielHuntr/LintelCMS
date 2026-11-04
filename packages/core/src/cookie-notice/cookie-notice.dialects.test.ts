import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  findStoredCookieNotice,
  listPublishedDesigns,
  saveStoredCookieNotice,
} from "./cookie-notice.repository.js";

describeOnEveryDatabase("Cookie notice", (handle) => {
  it("saves the notice", async () => {
    const { database } = handle;
    await saveStoredCookieNotice(database, { enabled: true });
    expect(await findStoredCookieNotice(database)).toEqual({ enabled: true });
  });

  it("reads only published designs, as JSON", async () => {
    const { database } = handle;
    const design = { root: { children: ["a", 1, null] } };
    const entry = await addTestEntry(database, { publishedData: { design, title: "Home" } });
    const other = await addTestEntry(database, {
      slug: "no-design",
      publishedData: { title: "x" },
    });
    await addTestEntry(database, { slug: "draft", data: { design } });

    const designs = await listPublishedDesigns(database, {
      collectionId: entry.collectionId,
      siteId: other.siteId,
    });
    expect(designs).toEqual([design]);
  });
});
