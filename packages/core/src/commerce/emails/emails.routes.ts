import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { pageQuerySchema, readIdParam } from "../commerce-params.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { findOutboxEmailRow, listOutboxEmailRows } from "./outbox.repository.js";
import type { OutboxEmailRow } from "./outbox.table.js";

/**
 * HTTP only. The outbox: emails kept instead of sent, so they can be read while developing.
 *
 *   GET /shop/emails       (commerce:read)  ?page&perPage -> { provider, items, total }
 *   GET /shop/emails/:id   (commerce:read)  one email with its text and HTML
 */
export async function emailsRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const read = { preHandler: requirePermission("commerce:read") };

  server.get("/shop/emails", read, async (request) => {
    const page = parseRequest(pageQuerySchema, request.query);
    const { rows, total } = await listOutboxEmailRows(server.database, page);
    return {
      provider: { name: shop.emails.name, deliversEmail: shop.emails.deliversEmail },
      items: rows.map(({ text: _text, html: _html, ...summary }) => describeEmail(summary)),
      total,
    };
  });

  server.get("/shop/emails/:id", read, async (request) => {
    const row = await findOutboxEmailRow(server.database, readIdParam(request.params, "email"));
    if (!row) {
      throw new ShopRecordNotFoundError("email");
    }
    return { ...describeEmail(row), text: row.text, html: row.html };
  });
}

function describeEmail(row: Omit<OutboxEmailRow, "text" | "html">) {
  return {
    id: row.id,
    kind: row.kind,
    to: row.to,
    subject: row.subject,
    orderId: row.orderId,
    createdAt: row.createdAt.toISOString(),
  };
}
