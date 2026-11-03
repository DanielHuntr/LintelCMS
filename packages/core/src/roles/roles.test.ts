import { pluginRegistry } from "../plugins/plugins.registry.js";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { corePermissionGroups } from "./permission-catalog.js";
import { builtInRoles } from "./built-in-roles.js";
import { rolesTable } from "./roles.table.js";

describe("roles", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asOwner: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createPersonWithRole(testDatabase.database, "olive@example.com", "owner");
    asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
  });

  afterEach(() => server.close());

  it("has the five built-in roles, with how many people have each", async () => {
    const response = await asOwner("GET", "/roles");

    expect(response.json().roles.map((role: { name: string }) => role.name)).toEqual([
      "Owner",
      "Admin",
      "Editor",
      "Author",
      "Viewer",
    ]);
    expect(response.json().roles[0]).toMatchObject({
      isBuiltIn: true,
      memberCount: 1,
      permissions: ["*"],
    });
  });

  // The built-in roles are made within the same moment; listed by creation time alone, they
  // could come out in alphabetical order instead (seen as a failure under load).
  it("lists the built-in roles in their own order, even when they were made at the same moment", async () => {
    await asOwner("GET", "/roles");
    await testDatabase.database
      .update(rolesTable)
      .set({ createdAt: new Date("2026-01-01T00:00:00Z") });
    const response = await asOwner("GET", "/roles");
    expect(response.json().roles.map((role: { name: string }) => role.name)).toEqual([
      "Owner",
      "Admin",
      "Editor",
      "Author",
      "Viewer",
    ]);
  });

  it("describes every permission in words, and adds a plugin's group once it is on", async () => {
    const before = await asOwner("GET", "/permissions");
    await setEnabledPlugins(testDatabase.database, server.plugins, ["commerce"]);
    const after = await asOwner("GET", "/permissions");

    const groupIds = (response: typeof before) =>
      response.json().groups.map((group: { id: string }) => group.id);
    expect(groupIds(before)).not.toContain("plugin-commerce");
    expect(groupIds(after)).toContain("plugin-commerce");
    for (const group of after.json().groups) {
      expect(group.name).toBeTruthy();
      for (const permission of group.permissions) {
        expect(permission.name).toBeTruthy();
        expect(permission.permission).toMatch(/^[a-z-]+:[a-z-]+$/);
      }
    }
  });

  it("only gives built-in roles permissions the catalog describes", () => {
    // Built-in plugins' own permissions count too (Editors may see Visitors).
    const described = [
      ...corePermissionGroups.flatMap((group) => group.permissions.map((p) => p.permission)),
      ...pluginRegistry.flatMap((plugin) =>
        (plugin.permissions ?? []).map((p: { permission: string }) => p.permission),
      ),
    ];
    for (const role of builtInRoles.filter((role) => role.handle !== "owner")) {
      for (const permission of role.permissions.filter((p) => !p.endsWith(":*"))) {
        expect(described, `${role.name}: ${permission}`).toContain(permission);
      }
    }
  });

  it("creates, changes and deletes a custom role", async () => {
    const created = await asOwner("POST", "/roles", {
      name: "Shop manager",
      description: "Runs the shop",
      permissions: ["entries:read", "media:read"],
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      handle: "shop-manager",
      isBuiltIn: false,
      memberCount: 0,
    });

    const changed = await asOwner("PATCH", `/roles/${created.json().id}`, {
      permissions: ["entries:read", "entries:update", "media:read"],
      requiresTwoFactor: true,
    });
    expect(changed.json()).toMatchObject({
      permissions: ["entries:read", "entries:update", "media:read"],
      requiresTwoFactor: true,
    });

    expect((await asOwner("DELETE", `/roles/${created.json().id}`)).statusCode).toBe(204);
    const log = await asOwner("GET", "/security-log");
    expect(log.json().events.map((event: { kind: string }) => event.kind)).toEqual([
      "role-deleted",
      "role-updated",
      "role-created",
      "sign-in",
    ]);
  });

  it("refuses unknown permissions and duplicate names", async () => {
    const unknown = await asOwner("POST", "/roles", { name: "Odd", permissions: ["entries:fly"] });
    const wildcard = await asOwner("POST", "/roles", { name: "Odd", permissions: ["*"] });
    const duplicate = await asOwner("POST", "/roles", { name: "editor", permissions: [] });

    expect(unknown.statusCode).toBe(400);
    expect(wildcard.statusCode).toBe(400);
    expect(duplicate.statusCode).toBe(409);
  });

  it("keeps built-in roles' permissions fixed, but lets them require two-factor", async () => {
    const editor = (await asOwner("GET", "/roles"))
      .json()
      .roles.find((role: { handle: string }) => role.handle === "editor");

    const rename = await asOwner("PATCH", `/roles/${editor.id}`, { name: "Writer" });
    const remove = await asOwner("DELETE", `/roles/${editor.id}`);
    const requireTwoFactor = await asOwner("PATCH", `/roles/${editor.id}`, {
      requiresTwoFactor: true,
    });

    expect(rename.json()).toMatchObject({ code: "BUILT_IN_ROLE" });
    expect(remove.json()).toMatchObject({ code: "BUILT_IN_ROLE" });
    expect(requireTwoFactor.json()).toMatchObject({ requiresTwoFactor: true });
  });

  it("won't delete a role someone still has", async () => {
    const role = (
      await asOwner("POST", "/roles", { name: "Helpers", permissions: ["entries:read"] })
    ).json();
    const { user } = await createPersonWithRole(testDatabase.database, "ed@example.com", "editor");
    await asOwner("PUT", `/users/${user.id}/role`, { roleId: role.id });

    const response = await asOwner("DELETE", `/roles/${role.id}`);

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("1 person has the Helpers role");
  });

  it("doesn't let someone give a role more than they can do themselves", async () => {
    await createTestUser(testDatabase.database, "rory@example.com", [
      ["roles:update", "users:read", "entries:read"],
    ]);
    const asRoleManager = requestsAs(server, await signInAndGetCookies(server, "rory@example.com"));

    const allowed = await asRoleManager("POST", "/roles", {
      name: "Readers",
      permissions: ["entries:read"],
    });
    const escalation = await asRoleManager("POST", "/roles", {
      name: "Sneaky",
      permissions: ["settings:update"],
    });

    expect(allowed.statusCode).toBe(201);
    expect(escalation.statusCode).toBe(403);
    expect(escalation.json().message).toContain("Change settings");
  });
});
