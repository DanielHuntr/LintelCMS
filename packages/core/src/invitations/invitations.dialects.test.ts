import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { insertRole } from "../roles/roles.repository.js";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteInvitationRow,
  findInvitationRow,
  listInvitationRows,
  updateInvitationToken,
  upsertInvitation,
} from "./invitations.repository.js";

const tenantId = "default";
const expiresAt = new Date("2030-01-01T00:00:00.000Z");

async function invite(database: Database) {
  const role = await insertRole(database, { handle: "editor", name: "Editor" });
  const inviter = await addTestUser(database);
  const invitation = { tenantId, email: "new@example.com", roleId: role.id, expiresAt };
  return { role, inviter, invitation: { ...invitation, invitedBy: inviter.id } };
}

describeOnEveryDatabase("Invitations", (handle) => {
  it("sends one invitation per address, replacing the last", async () => {
    const { database } = handle;
    const { invitation } = await invite(database);
    const first = await upsertInvitation(database, { ...invitation, tokenHash: "a" });
    const second = await upsertInvitation(database, { ...invitation, tokenHash: "b" });
    expect(second.id).toBe(first.id);
    expect(second.tokenHash).toBe("b");

    const rows = await listInvitationRows(database, tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ roleName: "Editor", inviterName: "Ada" });
  });

  it("finds an invitation by token and renews it", async () => {
    const { database } = handle;
    const { invitation } = await invite(database);
    const saved = await upsertInvitation(database, { ...invitation, tokenHash: "a" });
    expect((await findInvitationRow(database, { tenantId, tokenHash: "a" }))?.id).toBe(saved.id);

    const later = new Date("2031-01-01T00:00:00.000Z");
    await updateInvitationToken(database, saved.id, "b", later);
    const found = await findInvitationRow(database, { tenantId, id: saved.id });
    expect(found).toMatchObject({ tokenHash: "b", expiresAt: later });
  });

  it("deletes an invitation once", async () => {
    const { database } = handle;
    const { invitation } = await invite(database);
    const saved = await upsertInvitation(database, { ...invitation, tokenHash: "a" });
    expect(await deleteInvitationRow(database, saved.id)).toBe(true);
    expect(await deleteInvitationRow(database, saved.id)).toBe(false);
  });
});
