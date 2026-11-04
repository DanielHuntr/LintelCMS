import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { isUniqueViolation } from "../../database/database-errors.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { DiscountCodeTakenError } from "./discounts.errors.js";
import {
  countUsedRedemptions,
  deleteDiscountRow,
  findDiscountRow,
  findDiscountRowByCode,
  insertDiscount,
  listDiscountRows,
  updateDiscountRow,
} from "./discounts.repository.js";
import type { DiscountRequest, DiscountResponse } from "./discounts.schema.js";
import type { DiscountRow, NewDiscountRow } from "./discounts.table.js";

/** Shop → Discounts: making, changing and removing codes and automatic discounts. */

export async function listDiscounts(
  database: DatabaseOrTransaction,
  now: Date,
): Promise<{ discounts: DiscountResponse[] }> {
  const rows = await listDiscountRows(database);
  const used = await countUsedRedemptions(
    database,
    rows.map((row) => row.id),
  );
  return { discounts: rows.map((row) => describeDiscount(row, used.get(row.id) ?? 0, now)) };
}

export async function findDiscount(
  database: DatabaseOrTransaction,
  discountId: string,
  now: Date,
): Promise<DiscountResponse> {
  const row = await findDiscountRow(database, discountId);
  if (!row) throw new ShopRecordNotFoundError("discount");
  const used = await countUsedRedemptions(database, [row.id]);
  return describeDiscount(row, used.get(row.id) ?? 0, now);
}

export async function createDiscount(
  database: DatabaseOrTransaction,
  request: DiscountRequest,
  now: Date,
): Promise<DiscountResponse> {
  const columns = discountColumns(request, now);
  await refuseTakenCode(database, columns.code ?? null, undefined);
  const row = await saveRefusingTakenCode(columns.code ?? null, () =>
    insertDiscount(database, { tenantId: DEFAULT_TENANT_ID, ...columns }),
  );
  return describeDiscount(row, 0, now);
}

export async function updateDiscount(
  database: DatabaseOrTransaction,
  discountId: string,
  request: DiscountRequest,
  now: Date,
): Promise<DiscountResponse> {
  const existing = await findDiscountRow(database, discountId);
  if (!existing) throw new ShopRecordNotFoundError("discount");
  const columns = discountColumns(request, now, existing);
  await refuseTakenCode(database, columns.code ?? null, discountId);
  await saveRefusingTakenCode(columns.code ?? null, () =>
    updateDiscountRow(database, discountId, columns),
  );
  return findDiscount(database, discountId, now);
}

/** Orders keep their own copy of the discounts they had, so deleting changes no history. */
export async function deleteDiscount(
  database: DatabaseOrTransaction,
  discountId: string,
): Promise<void> {
  if (!(await deleteDiscountRow(database, discountId))) {
    throw new ShopRecordNotFoundError("discount");
  }
}

export function describeDiscount(
  row: DiscountRow,
  usageCount: number,
  now: Date,
): DiscountResponse {
  return {
    id: row.id,
    title: row.title,
    method: row.method,
    code: row.code,
    kind: row.kind,
    percentOff: row.percentOff,
    amounts: row.amounts,
    buyQuantity: row.buyQuantity,
    getQuantity: row.getQuantity,
    scope: row.scope,
    productIds: row.productIds,
    collectionIds: row.collectionIds,
    minimumSpend: row.minimumSpend,
    minimumQuantity: row.minimumQuantity,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    usageLimit: row.usageLimit,
    perCustomerLimit: row.perCustomerLimit,
    combinesWithOthers: row.combinesWithOthers,
    enabled: row.enabled,
    status: statusOf(row, usageCount, now),
    usageCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function statusOf(row: DiscountRow, usageCount: number, now: Date): DiscountResponse["status"] {
  if (!row.enabled) return "off";
  if (row.endsAt && row.endsAt <= now) return "expired";
  if (row.usageLimit !== null && usageCount >= row.usageLimit) return "used_up";
  if (row.startsAt > now) return "scheduled";
  return "active";
}

/** Only what the discount's kind and scope use is kept, so a stale field can't surprise later. */
function discountColumns(
  request: DiscountRequest,
  now: Date,
  existing?: DiscountRow,
): Omit<NewDiscountRow, "tenantId"> {
  const { kind, scope } = request;
  return {
    title: request.title,
    method: request.method,
    code: request.method === "code" ? request.code : null,
    kind,
    percentOff: kind === "percentage" || kind === "buy_x_get_y" ? (request.percentOff ?? 100) : 0,
    amounts: kind === "fixed_amount" ? request.amounts : {},
    buyQuantity: kind === "buy_x_get_y" ? request.buyQuantity : 0,
    getQuantity: kind === "buy_x_get_y" ? request.getQuantity : 0,
    scope,
    productIds: scope === "products" ? request.productIds : [],
    collectionIds: scope === "collections" ? request.collectionIds : [],
    minimumSpend: request.minimumSpend,
    minimumQuantity: request.minimumQuantity,
    startsAt: request.startsAt ? new Date(request.startsAt) : (existing?.startsAt ?? now),
    endsAt: request.endsAt ? new Date(request.endsAt) : null,
    usageLimit: request.usageLimit,
    perCustomerLimit: request.perCustomerLimit,
    combinesWithOthers: request.combinesWithOthers,
    enabled: request.enabled,
  };
}

async function refuseTakenCode(
  database: DatabaseOrTransaction,
  code: string | null,
  ownId: string | undefined,
): Promise<void> {
  if (!code) return;
  const holder = await findDiscountRowByCode(database, code);
  if (holder && holder.id !== ownId) throw new DiscountCodeTakenError(code);
}

/** Someone saved the same code at the same moment: the unique index decides. */
async function saveRefusingTakenCode<Result>(
  code: string | null,
  save: () => Promise<Result>,
): Promise<Result> {
  try {
    return await save();
  } catch (error) {
    if (code && isUniqueViolation(error)) throw new DiscountCodeTakenError(code);
    throw error;
  }
}
