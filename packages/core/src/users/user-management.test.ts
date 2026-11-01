import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";
import { findRoleByHandle } from "../roles/roles.repository.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies, TEST_PASSWORD } from "../testing/test-users.js";

describe("managing people", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asOwner: SendRequest;
  let owner: { id: string };

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    owner = (
      await createPersonWithRole(testDatabase.database, "olive@example.com", "owner", "Olive Owner")
    ).user;
    asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
  });

  afterEach(() => server.close());

  async function roleId(handle: string): Promise<string> {
    const role = await findRoleByHandle(testDatabase.database, DEFAULT_TENANT_ID, handle);
    return role!.id;
  }

  it("lists people with their roles and status, and searches by name or email", async () => {
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor", "Ed Editor");

    const all = await asOwner("GET", "/users");
    const search = await asOwner("GET", "/users?search=edit");

    expect(all.statusCode).toBe(200);
    expect(all.json().users).toHaveLength(2);
    expect(search.json().users).toEqual([
      expect.objectContaining({
        email: "ed@example.com",
        status: "active",
        roles: [expect.objectContaining({ name: "Editor", handle: "editor" })],
        twoFactorEnabled: false,
        lastActiveAt: null,
      }),
    ]);
    const me = all.json().users.find((user: { id: string }) => user.id === owner.id);
    expect(me.lastActiveAt).not.toBeNull();
  });

  it("changes someone's role and logs it", async () => {
    const { user: ed } = await createPersonWithRole(
      testDatabase.database,
      "ed@example.com",
      "editor",
    );

    const response = await asOwner("PUT", `/users/${ed.id}/role`, {
      roleId: await roleId("admin"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().roles).toEqual([expect.objectContaining({ handle: "admin" })]);
    const log = await asOwner("GET", "/security-log?kind=role-changed");
    expect(log.json().events[0]).toMatchObject({
      actor: { email: "olive@example.com" },
      subject: { id: ed.id },
      details: { from: "Editor", to: "Admin" },
    });
  });

  describe("the last owner", () => {
    it("can't be demoted", async () => {
      const response = await asOwner("PUT", `/users/${owner.id}/role`, {
        roleId: await roleId("admin"),
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "LAST_OWNER" });
    });

    it("can step down once there is another active owner", async () => {
      await createPersonWithRole(testDatabase.database, "oscar@example.com", "owner");

      const response = await asOwner("PUT", `/users/${owner.id}/role`, {
        roleId: await roleId("admin"),
      });

      expect(response.statusCode).toBe(200);
    });

    it("doesn't count a deactivated owner", async () => {
      const { user: oscar } = await createPersonWithRole(
        testDatabase.database,
        "oscar@example.com",
        "owner",
      );
      expect((await asOwner("POST", `/users/${oscar.id}/deactivate`)).statusCode).toBe(200);

      const response = await asOwner("PUT", `/users/${owner.id}/role`, {
        roleId: await roleId("admin"),
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("owners and admins", () => {
    let asAdmin: SendRequest;

    beforeEach(async () => {
      await createPersonWithRole(testDatabase.database, "ada@example.com", "admin");
      asAdmin = requestsAs(server, await signInAndGetCookies(server, "ada@example.com"));
    });

    it("only lets owners change an owner", async () => {
      const deactivate = await asAdmin("POST", `/users/${owner.id}/deactivate`);
      const demote = await asAdmin("PUT", `/users/${owner.id}/role`, {
        roleId: await roleId("viewer"),
      });

      expect(deactivate.statusCode).toBe(403);
      expect(deactivate.json()).toMatchObject({ code: "OWNERS_ONLY" });
      expect(demote.statusCode).toBe(403);
    });

    it("doesn't let an admin make anyone an owner, themselves included", async () => {
      const { user: ed } = await createPersonWithRole(
        testDatabase.database,
        "ed@example.com",
        "editor",
      );

      const response = await asAdmin("PUT", `/users/${ed.id}/role`, {
        roleId: await roleId("owner"),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "CANNOT_GRANT_PERMISSION" });
    });

    it("lets an admin change editors, authors and viewers", async () => {
      const { user: ed } = await createPersonWithRole(
        testDatabase.database,
        "ed@example.com",
        "editor",
      );

      const response = await asAdmin("PUT", `/users/${ed.id}/role`, {
        roleId: await roleId("author"),
      });

      expect(response.statusCode).toBe(200);
    });
  });

  it("needs users:update to change people, and users:read to see them", async () => {
    const { user: ed } = await createPersonWithRole(
      testDatabase.database,
      "ed@example.com",
      "editor",
    );
    const asEditor = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));

    expect((await asEditor("GET", "/users")).statusCode).toBe(403);
    expect((await asEditor("POST", `/users/${ed.id}/deactivate`)).statusCode).toBe(403);
  });

  it("deactivates someone: signs them out, stops sign-in and their API tokens, and reactivates", async () => {
    const { user: ada } = await createPersonWithRole(
      testDatabase.database,
      "ada@example.com",
      "admin",
    );
    const adaCookies = await signInAndGetCookies(server, "ada@example.com");
    const asAda = requestsAs(server, adaCookies);
    const token = (await asAda("POST", "/api-tokens", { name: "Site", access: "read" })).json()
      .secret;

    const deactivated = await asOwner("POST", `/users/${ada.id}/deactivate`);

    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().status).toBe("deactivated");
    expect((await asAda("GET", "/auth/me")).statusCode).toBe(401);
    const signIn = await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: "ada@example.com", password: TEST_PASSWORD },
    });
    expect(signIn.statusCode).toBe(403);
    expect(signIn.json()).toMatchObject({ code: "ACCOUNT_DEACTIVATED" });
    const withToken = await server.inject({
      method: "GET",
      url: "/media",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(withToken.statusCode).toBe(401);

    const reactivated = await asOwner("POST", `/users/${ada.id}/reactivate`);
    expect(reactivated.json().status).toBe("active");
    expect(
      (await signInAndGetCookies(server, "ada@example.com"))[SESSION_COOKIE_NAME],
    ).toBeTruthy();
  });

  it("won't deactivate or remove your own account", async () => {
    const deactivate = await asOwner("POST", `/users/${owner.id}/deactivate`);
    const remove = await asOwner("DELETE", `/users/${owner.id}`, { reassignToUserId: owner.id });

    expect(deactivate.json()).toMatchObject({ code: "OWN_ACCOUNT" });
    expect(remove.json()).toMatchObject({ code: "OWN_ACCOUNT" });
  });

  it("removes someone and gives their content to the person chosen", async () => {
    await ensureBlogPostsCollection(testDatabase.database);
    const { user: ed } = await createPersonWithRole(
      testDatabase.database,
      "ed@example.com",
      "editor",
    );
    const asEditor = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));
    const post = (
      await asEditor("POST", "/collections/posts/entries", { data: { title: "Hello" } })
    ).json();

    const response = await asOwner("DELETE", `/users/${ed.id}`, { reassignToUserId: owner.id });

    expect(response.statusCode).toBe(204);
    const [entry] = await testDatabase.database.select().from(entriesTable);
    expect(entry).toMatchObject({ id: post.id, createdBy: owner.id, updatedBy: owner.id });
    expect(await testDatabase.database.select().from(sessionsTable)).toHaveLength(1);
    expect((await asOwner("GET", `/users/${ed.id}`)).statusCode).toBe(404);
    const log = await asOwner("GET", "/security-log?kind=user-removed");
    expect(log.json().events[0]).toMatchObject({
      subject: { id: null, name: "ed" },
      details: { entriesMoved: 1, contentMovedTo: "Olive Owner" },
    });
  });

  it("refuses to give content to the person being removed, or to nobody", async () => {
    const { user: ed } = await createPersonWithRole(
      testDatabase.database,
      "ed@example.com",
      "editor",
    );

    const toThemselves = await asOwner("DELETE", `/users/${ed.id}`, { reassignToUserId: ed.id });
    const missing = await asOwner("DELETE", `/users/${ed.id}`, {});

    expect(toThemselves.statusCode).toBe(400);
    expect(missing.statusCode).toBe(400);
  });
});
