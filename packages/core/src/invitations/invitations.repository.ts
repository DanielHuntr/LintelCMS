import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { rolesTable } from "../roles/roles.table.js";
import { usersTable } from "../users/users.table.js";
import { type Invitation, invitationsTable, type NewInvitation } from "./invitations.table.js";

/** Database reads and writes for invitations, nothing else. */

export interface InvitationWithNames extends Invitation {
  roleName: string;
  inviterName: string | null;
}

const withNames = {
  invitation: invitationsTable,
  roleName: rolesTable.name,
  inviterName: usersTable.name,
};

export async function listInvitationRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<InvitationWithNames[]> {
  const rows = await database
    .select(withNames)
    .from(invitationsTable)
    .innerJoin(rolesTable, eq(rolesTable.id, invitationsTable.roleId))
    .leftJoin(usersTable, eq(usersTable.id, invitationsTable.invitedBy))
    .where(eq(invitationsTable.tenantId, tenantId))
    .orderBy(desc(invitationsTable.createdAt));
  return rows.map((row) => ({
    ...row.invitation,
    roleName: row.roleName,
    inviterName: row.inviterName,
  }));
}

export async function findInvitationRow(
  database: DatabaseOrTransaction,
  condition: { tenantId: string; id?: string; tokenHash?: string; email?: string },
): Promise<InvitationWithNames | undefined> {
  const [row] = await database
    .select(withNames)
    .from(invitationsTable)
    .innerJoin(rolesTable, eq(rolesTable.id, invitationsTable.roleId))
    .leftJoin(usersTable, eq(usersTable.id, invitationsTable.invitedBy))
    .where(
      and(
        eq(invitationsTable.tenantId, condition.tenantId),
        condition.id ? eq(invitationsTable.id, condition.id) : undefined,
        condition.tokenHash ? eq(invitationsTable.tokenHash, condition.tokenHash) : undefined,
        condition.email ? eq(invitationsTable.email, condition.email) : undefined,
      ),
    )
    .limit(1);
  return row && { ...row.invitation, roleName: row.roleName, inviterName: row.inviterName };
}

/** Inviting the same address again replaces the old invitation. */
export async function upsertInvitation(
  database: DatabaseOrTransaction,
  invitation: NewInvitation & { tenantId: string },
): Promise<Invitation> {
  const [saved] = await database
    .insert(invitationsTable)
    .values(invitation)
    .onConflictDoUpdate({
      target: [invitationsTable.tenantId, invitationsTable.email],
      set: {
        roleId: invitation.roleId,
        invitedBy: invitation.invitedBy,
        tokenHash: invitation.tokenHash,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    })
    .returning();
  if (!saved) {
    throw new Error("The database did not return the invitation.");
  }
  return saved;
}

export async function updateInvitationToken(
  database: DatabaseOrTransaction,
  invitationId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await database
    .update(invitationsTable)
    .set({ tokenHash, expiresAt })
    .where(eq(invitationsTable.id, invitationId));
}

export async function deleteInvitationRow(
  database: DatabaseOrTransaction,
  invitationId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(invitationsTable)
    .where(eq(invitationsTable.id, invitationId))
    .returning({ id: invitationsTable.id });
  return deleted.length > 0;
}
