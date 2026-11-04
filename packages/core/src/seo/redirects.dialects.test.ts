import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteRedirectFrom,
  deleteRedirectRow,
  findRedirectFrom,
  findRedirectRow,
  insertRedirect,
  listRedirectRows,
  retargetRedirects,
  updateRedirectRow,
} from "./redirects.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Redirects", (handle) => {
  it("saves a long address and finds it exactly", async () => {
    const { database } = handle;
    const fromPath = `/${"long-address/".repeat(40)}`;
    const redirect = await insertRedirect(database, { fromPath, toPath: "/new" });
    expect(redirect.statusCode).toBe(301);
    expect((await findRedirectFrom(database, TENANT, fromPath))?.id).toBe(redirect.id);
    expect(await findRedirectFrom(database, TENANT, fromPath.toUpperCase())).toBeUndefined();
    expect((await findRedirectRow(database, TENANT, redirect.id))?.toPath).toBe("/new");
  });

  it("changes redirects and points old ones at a new target", async () => {
    const { database } = handle;
    const first = await insertRedirect(database, { fromPath: "/a", toPath: "/b" });
    const second = await insertRedirect(database, { fromPath: "/c", toPath: "/b" });
    await updateRedirectRow(database, TENANT, first.id, { statusCode: 302 });
    await retargetRedirects(database, TENANT, "/b", "/d", first.id);

    expect((await findRedirectRow(database, TENANT, first.id))?.statusCode).toBe(302);
    expect((await findRedirectRow(database, TENANT, second.id))?.toPath).toBe("/d");
    expect(await listRedirectRows(database, TENANT)).toHaveLength(2);
  });

  it("deletes by id, saying if it did, and by address", async () => {
    const { database } = handle;
    const first = await insertRedirect(database, { fromPath: "/a", toPath: "/b" });
    await insertRedirect(database, { fromPath: "/c", toPath: "/b" });
    expect(await deleteRedirectRow(database, TENANT, first.id)).toBe(true);
    expect(await deleteRedirectRow(database, TENANT, first.id)).toBe(false);
    await deleteRedirectFrom(database, TENANT, "/c");
    expect(await listRedirectRows(database, TENANT)).toEqual([]);
  });
});
