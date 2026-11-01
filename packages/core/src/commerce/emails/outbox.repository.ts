import { and, count, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { EmailMessage } from "./email-provider.js";
import { type OutboxEmailRow, outboxEmailsTable } from "./outbox.table.js";

/** Database reads and writes for the outbox. */

export async function insertOutboxEmail(
  database: DatabaseOrTransaction,
  message: EmailMessage,
): Promise<void> {
  await database.insert(outboxEmailsTable).values({
    tenantId: DEFAULT_TENANT_ID,
    kind: message.kind,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    orderId: message.orderId ?? null,
  });
}

export async function listOutboxEmailRows(
  database: DatabaseOrTransaction,
  page: { page: number; perPage: number },
): Promise<{ rows: OutboxEmailRow[]; total: number }> {
  const where = eq(outboxEmailsTable.tenantId, DEFAULT_TENANT_ID);
  const rows = await database
    .select()
    .from(outboxEmailsTable)
    .where(where)
    .orderBy(desc(outboxEmailsTable.createdAt))
    .limit(page.perPage)
    .offset((page.page - 1) * page.perPage);
  const [total] = await database.select({ value: count() }).from(outboxEmailsTable).where(where);
  return { rows, total: total?.value ?? 0 };
}

export async function findOutboxEmailRow(
  database: DatabaseOrTransaction,
  emailId: string,
): Promise<OutboxEmailRow | undefined> {
  const [row] = await database
    .select()
    .from(outboxEmailsTable)
    .where(
      and(eq(outboxEmailsTable.tenantId, DEFAULT_TENANT_ID), eq(outboxEmailsTable.id, emailId)),
    )
    .limit(1);
  return row;
}
