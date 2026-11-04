import { expect, it } from "vitest";
import { assignRoleToUser, insertRole } from "../roles/roles.repository.js";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  findPeopleByIds,
  listPeopleWithRole,
  listRoleHandlesForUser,
  listRoles,
} from "./workflow-people.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Workflow people", (handle) => {
  it("finds people by role and by id", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const role = await insertRole(database, { handle: "editor", name: "Editor" });
    await assignRoleToUser(database, user.id, role.id);

    const withRole = await listPeopleWithRole(database, TENANT, "editor");
    expect(withRole.map((person) => person.id)).toEqual([user.id]);
    expect(await listRoleHandlesForUser(database, user.id)).toEqual(["editor"]);
    expect(await listRoles(database, TENANT)).toEqual([{ handle: "editor", name: "Editor" }]);
    expect((await findPeopleByIds(database, [user.id]))[0]?.id).toBe(user.id);
  });
});
