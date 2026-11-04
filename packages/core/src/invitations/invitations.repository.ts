import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { rolesTable as rolesDefinition } from "../roles/roles.table.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import {
  type Invitation,
  invitationsTable as invitationsDefinition,
  type NewInvitation,
} from "./invitations.table.js";
import { deleteReturning, upsertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for invitations, nothing else. */

export interface InvitationWithNames extends Invitation {
  roleName: string;
  inviterName: string | null;
}

function withNames(database: DatabaseOrTransaction) {
  return {
    invitation: tableFor(database, invitationsDefinition),
    roleName: tableFor(database, rolesDefinition).name,
    inviterName: tableFor(database, usersDefinition).name,
  };
}

export async function listInvitationRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<InvitationWithNames[]> {
  const invitationsTable = tableFor(database, invitationsDefinition);
  const rolesTable = tableFor(database, rolesDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const rows = await database
    .select(withNames(database))
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
  const invitationsTable = tableFor(database, invitationsDefinition);
  const rolesTable = tableFor(database, rolesDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const [row] = await database
    .select(withNames(database))
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
  const invitationsTable = tableFor(database, invitationsDefinition);
  const [saved] = await upsertReturning(database, invitationsTable, invitation, {
    target: [invitationsTable.tenantId, invitationsTable.email],
    set: {
      roleId: invitation.roleId,
      invitedBy: invitation.invitedBy,
      tokenHash: invitation.tokenHash,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    },
    // Token hashes are random, so only the email can clash.
    otherKeysCannotClash: true,
  });
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
  const invitationsTable = tableFor(database, invitationsDefinition);
  await database
    .update(invitationsTable)
    .set({ tokenHash, expiresAt })
    .where(eq(invitationsTable.id, invitationId));
}

export async function deleteInvitationRow(
  database: DatabaseOrTransaction,
  invitationId: string,
): Promise<boolean> {
  const invitationsTable = tableFor(database, invitationsDefinition);
  const deleted = await deleteReturning(
    database,
    invitationsTable,
    eq(invitationsTable.id, invitationId),
    { id: invitationsTable.id },
  );
  return deleted.length > 0;
}
