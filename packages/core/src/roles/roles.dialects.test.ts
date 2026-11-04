import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  assignRoleToUser,
  deleteRoleRow,
  findActiveUserIdsWithRole,
  findPermissionListsForUser,
  findRoleByHandle,
  findRoleById,
  findRolesForUsers,
  findSiteListsForUser,
  insertRole,
  listRoleRows,
  removeSiteFromRoles,
  replaceRolesOfUser,
  updateRoleRow,
  updateRoleSiteIds,
  upsertRoleByHandle,
} from "./roles.repository.js";

const tenantId = "default";
const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER_SITE = "22222222-2222-4222-8222-222222222222";
const editor = { handle: "editor", name: "Editor", permissions: ["entries:edit"] };

describeOnEveryDatabase("Roles", (handle) => {
  it("saves roles with lists of permissions, and changes them", async () => {
    const { database } = handle;
    const role = await insertRole(database, editor);
    expect(role.permissions).toEqual(editor.permissions);
    expect(role.siteIds).toBeNull();
    await updateRoleRow(database, role.id, { permissions: ["a", "b"] });
    expect((await findRoleById(database, tenantId, role.id))?.permissions).toEqual(["a", "b"]);
    expect((await findRoleByHandle(database, tenantId, "editor"))?.id).toBe(role.id);
  });

  it("adds a role by handle, or brings it up to date", async () => {
    const { database } = handle;
    await upsertRoleByHandle(database, { ...editor, tenantId });
    await upsertRoleByHandle(database, { ...editor, tenantId, name: "Writer" });
    expect((await findRoleByHandle(database, tenantId, "editor"))?.name).toBe("Writer");
  });

  it("links people to roles and reads their permissions", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const first = await insertRole(database, editor);
    const second = await insertRole(database, { ...editor, handle: "second", permissions: ["x"] });

    await assignRoleToUser(database, user.id, first.id);
    await assignRoleToUser(database, user.id, first.id);
    expect(await findPermissionListsForUser(database, user.id)).toEqual([editor.permissions]);
    expect((await listRoleRows(database, tenantId))[0]?.memberCount).toBe(1);
    expect(await findActiveUserIdsWithRole(database, tenantId, "editor")).toEqual([user.id]);

    await replaceRolesOfUser(database, user.id, second.id);
    const roles = await findRolesForUsers(database, [user.id]);
    expect(roles.map((role) => role.handle)).toEqual(["second"]);
  });

  it("limits a role to sites, and takes a deleted site out", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const role = await insertRole(database, editor);
    const untouched = await insertRole(database, { ...editor, handle: "all" });
    await assignRoleToUser(database, user.id, role.id);
    await updateRoleSiteIds(database, role.id, [SITE, OTHER_SITE]);

    await removeSiteFromRoles(database, SITE);
    expect(await findSiteListsForUser(database, user.id)).toEqual([[OTHER_SITE]]);
    expect((await findRoleById(database, tenantId, untouched.id))?.siteIds).toBeNull();
  });

  it("deletes a role", async () => {
    const { database } = handle;
    const role = await insertRole(database, editor);
    await deleteRoleRow(database, role.id);
    expect(await findRoleById(database, tenantId, role.id)).toBeUndefined();
  });
});
