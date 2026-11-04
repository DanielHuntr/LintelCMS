import { expect, it } from "vitest";
import { assignRoleToUser, insertRole } from "../roles/roles.repository.js";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteRoleLayout,
  deleteUserLayout,
  findRoleLayoutsForUser,
  findUserLayout,
  listRolesWithLayouts,
  roleExists,
  upsertRoleLayout,
  upsertUserLayout,
} from "./dashboard.repository.js";
import type { WidgetPlacement } from "./dashboard.schema.js";

const TENANT = "default";
const NO_SUCH_ROLE = "11111111-1111-4111-8111-111111111111";
const first = [{ id: "a" }] as unknown as WidgetPlacement[];
const second = [{ id: "b" }] as unknown as WidgetPlacement[];

describeOnEveryDatabase("Dashboard layouts", (handle) => {
  it("saves a person's layout, changing it on the second save", async () => {
    const { database } = handle;
    const { id } = await addTestUser(database);
    await upsertUserLayout(database, TENANT, id, first);
    await upsertUserLayout(database, TENANT, id, second);
    expect(await findUserLayout(database, TENANT, id)).toEqual(second);
    await deleteUserLayout(database, TENANT, id);
    expect(await findUserLayout(database, TENANT, id)).toBeUndefined();
  });

  it("keeps a role's layout apart from everyone else's", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const other = await addTestUser(database, "other@example.com");
    const role = await insertRole(database, { handle: "editor", name: "Editor" });
    const otherRole = await insertRole(database, { handle: "other", name: "Other" });
    await assignRoleToUser(database, user.id, role.id);

    await upsertUserLayout(database, TENANT, other.id, first);
    await upsertRoleLayout(database, TENANT, otherRole.id, first);
    await upsertRoleLayout(database, TENANT, role.id, first);
    await upsertRoleLayout(database, TENANT, role.id, second);

    expect(await findRoleLayoutsForUser(database, TENANT, user.id)).toEqual([second]);
    expect(await findUserLayout(database, TENANT, other.id)).toEqual(first);
    const listed = await listRolesWithLayouts(database, TENANT);
    expect(listed.find((row) => row.id === role.id)?.widgets).toEqual(second);

    await deleteRoleLayout(database, TENANT, role.id);
    expect(await findRoleLayoutsForUser(database, TENANT, user.id)).toEqual([]);
  });

  it("knows which roles exist", async () => {
    const { database } = handle;
    const role = await insertRole(database, { handle: "editor", name: "Editor" });
    expect(await roleExists(database, TENANT, role.id)).toBe(true);
    expect(await roleExists(database, TENANT, NO_SUCH_ROLE)).toBe(false);
  });
});
