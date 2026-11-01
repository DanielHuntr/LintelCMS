import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole, tokenFromLatestEmail } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { invitationsTable } from "./invitations.table.js";

const NEW_PASSWORD = "a long password for the new person";

describe("invitations", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asOwner: SendRequest;
  let roleIds: Record<string, string>;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createPersonWithRole(testDatabase.database, "olive@example.com", "owner", "Olive Owner");
    asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
    const roles = (await asOwner("GET", "/roles")).json().roles as Array<{
      id: string;
      handle: string;
    }>;
    roleIds = Object.fromEntries(roles.map((role) => [role.handle, role.id]));
  });

  afterEach(() => server.close());

  function post(url: string, payload: Record<string, unknown>) {
    return server.inject({ method: "POST", url, payload });
  }

  it("emails a link that opens the accept screen, and accepting signs the new person in", async () => {
    const invited = await asOwner("POST", "/invitations", {
      email: "Nia@Example.com",
      roleId: roleIds.editor,
    });

    expect(invited.statusCode).toBe(201);
    expect(invited.json().invitation).toMatchObject({
      email: "nia@example.com",
      role: { name: "Editor" },
      invitedBy: { name: "Olive Owner" },
      expired: false,
    });
    expect(invited.json().invitationUrl).toMatch(
      /^http:\/\/localhost:5173\/accept-invitation#token=/,
    );
    const email = server.emailOutbox!.latestTo("nia@example.com")!;
    expect(email.text).toContain("Olive Owner has invited you");
    expect(email.text).toContain("as an Editor");

    const token = tokenFromLatestEmail(server, "nia@example.com");
    const preview = await post("/invitations/preview", { token });
    expect(preview.json()).toEqual({
      email: "nia@example.com",
      roleName: "Editor",
      invitedByName: "Olive Owner",
    });

    const accepted = await post("/invitations/accept", {
      token,
      name: "Nia New",
      password: NEW_PASSWORD,
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ user: { email: "nia@example.com", name: "Nia New" } });
    expect(accepted.json().permissions).toContain("entries:*");
    expect(await testDatabase.database.select().from(invitationsTable)).toEqual([]);

    const again = await post("/invitations/accept", {
      token,
      name: "Someone",
      password: NEW_PASSWORD,
    });
    expect(again.json()).toMatchObject({ code: "INVITATION_INVALID" });
  });

  it("lists invitations, and stops an old link working when resent", async () => {
    const invitation = (
      await asOwner("POST", "/invitations", { email: "nia@example.com", roleId: roleIds.viewer })
    ).json().invitation;
    const firstToken = tokenFromLatestEmail(server, "nia@example.com");

    const resent = await asOwner("POST", `/invitations/${invitation.id}/resend`);
    const secondToken = tokenFromLatestEmail(server, "nia@example.com");

    expect(resent.statusCode).toBe(200);
    expect(secondToken).not.toBe(firstToken);
    expect((await post("/invitations/preview", { token: firstToken })).statusCode).toBe(400);
    expect((await post("/invitations/preview", { token: secondToken })).statusCode).toBe(200);
    expect((await asOwner("GET", "/invitations")).json().invitations).toHaveLength(1);
  });

  it("can be cancelled, after which the link stops working", async () => {
    const invitation = (
      await asOwner("POST", "/invitations", { email: "nia@example.com", roleId: roleIds.viewer })
    ).json().invitation;
    const token = tokenFromLatestEmail(server, "nia@example.com");

    expect((await asOwner("DELETE", `/invitations/${invitation.id}`)).statusCode).toBe(204);

    expect(
      (await post("/invitations/accept", { token, name: "Nia", password: NEW_PASSWORD }))
        .statusCode,
    ).toBe(400);
  });

  it("expires after a week", async () => {
    await asOwner("POST", "/invitations", { email: "nia@example.com", roleId: roleIds.viewer });
    const token = tokenFromLatestEmail(server, "nia@example.com");
    await testDatabase.database
      .update(invitationsTable)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    const accepted = await post("/invitations/accept", {
      token,
      name: "Nia",
      password: NEW_PASSWORD,
    });

    expect(accepted.json()).toMatchObject({ code: "INVITATION_INVALID" });
    expect((await asOwner("GET", "/invitations")).json().invitations[0].expired).toBe(true);
  });

  it("refuses someone who already has an account, and roles the inviter can't give", async () => {
    await createPersonWithRole(testDatabase.database, "ada@example.com", "admin");
    const asAdmin = requestsAs(server, await signInAndGetCookies(server, "ada@example.com"));

    const existing = await asOwner("POST", "/invitations", {
      email: "ada@example.com",
      roleId: roleIds.viewer,
    });
    const owner = await asAdmin("POST", "/invitations", {
      email: "nia@example.com",
      roleId: roleIds.owner,
    });

    expect(existing.statusCode).toBe(409);
    expect(owner.statusCode).toBe(403);
  });

  it("asks for a name and a long enough password", async () => {
    await asOwner("POST", "/invitations", { email: "nia@example.com", roleId: roleIds.viewer });
    const token = tokenFromLatestEmail(server, "nia@example.com");

    const response = await post("/invitations/accept", { token, name: " ", password: "short" });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("Please enter a name");
    expect(response.json().message).toContain("at least 12 characters");
  });
});
