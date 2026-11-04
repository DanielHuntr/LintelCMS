import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteUserRow,
  findExistingUserIds,
  findUserByEmail,
  findUserById,
  findUserNamesByIds,
  hasAnyUsers,
  insertUser,
  listUserEmails,
  listUserRows,
  recordSignIn,
  updatePasswordHash,
  updateUserRow,
} from "./users.repository.js";

const TENANT = "default";
const ada = { email: "ada@example.com", name: "Ada Lovelace" };

describeOnEveryDatabase("Users", (handle) => {
  it("saves a person and finds them", async () => {
    const { database } = handle;
    expect(await hasAnyUsers(database, TENANT)).toBe(false);
    const user = await insertUser(database, ada);
    expect(user.status).toBe("active");
    expect(await hasAnyUsers(database, TENANT)).toBe(true);
    expect((await findUserByEmail(database, TENANT, ada.email))?.id).toBe(user.id);
    expect((await findUserById(database, user.id))?.name).toBe(ada.name);
    expect(await findExistingUserIds(database, [user.id])).toEqual([user.id]);
    expect(await findUserNamesByIds(database, [user.id])).toEqual([
      { id: user.id, name: ada.name },
    ]);
    expect(await listUserEmails(database, TENANT)).toEqual([ada.email]);
  });

  it("searches whatever the case, treating % as a plain character", async () => {
    const { database } = handle;
    await insertUser(database, ada);
    await insertUser(database, { email: "grace@example.com", name: "100% Grace" });
    const names = async (search: string | undefined) =>
      (await listUserRows(database, TENANT, search)).map((row) => row.name);
    expect(await names("LOVELACE")).toEqual([ada.name]);
    expect(await names("0%")).toEqual(["100% Grace"]);
    expect(await names(undefined)).toHaveLength(2);
  });

  it("shows no last session for someone who hasn't signed in", async () => {
    const { database } = handle;
    await insertUser(database, ada);
    const [row] = await listUserRows(database, TENANT, undefined);
    expect(row?.lastSessionUsedAt).toBeNull();
  });

  it("records sign-ins, changes people and deletes them", async () => {
    const { database } = handle;
    const user = await insertUser(database, ada);
    const when = new Date("2026-11-04T10:00:00.750Z");
    await recordSignIn(database, user.id, when);
    await updatePasswordHash(database, user.id, "hash");
    await updateUserRow(database, user.id, { name: "Ada" });
    expect(await findUserById(database, user.id)).toMatchObject({
      name: "Ada",
      passwordHash: "hash",
      lastSignedInAt: when,
    });
    await deleteUserRow(database, user.id);
    expect(await findUserById(database, user.id)).toBeUndefined();
  });
});
