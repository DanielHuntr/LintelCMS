import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteUserInterfaceLanguage,
  findUserInterfaceLanguage,
  upsertUserInterfaceLanguage,
} from "./interface-languages.repository.js";

describeOnEveryDatabase("Interface languages", (handle) => {
  it("saves, changes and removes a person's language", async () => {
    const { database } = handle;
    const { id } = await addTestUser(database);
    const tenant = "default";
    await upsertUserInterfaceLanguage(database, tenant, id, "fr");
    await upsertUserInterfaceLanguage(database, tenant, id, "de");
    expect(await findUserInterfaceLanguage(database, tenant, id)).toBe("de");
    await deleteUserInterfaceLanguage(database, tenant, id);
    expect(await findUserInterfaceLanguage(database, tenant, id)).toBeUndefined();
  });
});
