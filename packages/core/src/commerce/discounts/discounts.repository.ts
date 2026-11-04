import { and, asc, desc, eq, gt, inArray, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { checkoutsTable as checkoutsDefinition } from "../checkouts/checkouts.table.js";
import { collectionRulesCondition } from "../product-collections/product-collection-rules.js";
import {
  productCollectionItemsTable as productCollectionItemsDefinition,
  productCollectionsTable as productCollectionsDefinition,
} from "../product-collections/product-collections.table.js";
import { productsTable as productsDefinition } from "../products/products.table.js";
import type { DiscountUsage } from "./discount-rules.js";
import {
  discountRedemptionsTable as discountRedemptionsDefinition,
  type DiscountRow,
  discountsTable as discountsDefinition,
  type NewDiscountRow,
} from "./discounts.table.js";
import { deleteReturning, insertIfNew, insertReturning } from "../../database/dialect/writes.js";
import { countWhere } from "../../database/dialect/expressions.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for discounts and their uses. */

export async function listDiscountRows(database: DatabaseOrTransaction): Promise<DiscountRow[]> {
  const discountsTable = tableFor(database, discountsDefinition);
  return database
    .select()
    .from(discountsTable)
    .where(eq(discountsTable.tenantId, DEFAULT_TENANT_ID))
    .orderBy(desc(discountsTable.createdAt), asc(discountsTable.id));
}

export async function findDiscountRow(
  database: DatabaseOrTransaction,
  discountId: string,
): Promise<DiscountRow | undefined> {
  const discountsTable = tableFor(database, discountsDefinition);
  const [row] = await database
    .select()
    .from(discountsTable)
    .where(and(eq(discountsTable.tenantId, DEFAULT_TENANT_ID), eq(discountsTable.id, discountId)))
    .limit(1);
  return row;
}

export async function findDiscountRowByCode(
  database: DatabaseOrTransaction,
  code: string,
): Promise<DiscountRow | undefined> {
  const discountsTable = tableFor(database, discountsDefinition);
  const [row] = await database
    .select()
    .from(discountsTable)
    .where(and(eq(discountsTable.tenantId, DEFAULT_TENANT_ID), eq(discountsTable.code, code)))
    .limit(1);
  return row;
}

/** Code discounts for the codes given (already upper case). */
export async function listDiscountRowsByCodes(
  database: DatabaseOrTransaction,
  codes: readonly string[],
): Promise<DiscountRow[]> {
  const discountsTable = tableFor(database, discountsDefinition);
  if (codes.length === 0) return [];
  return database
    .select()
    .from(discountsTable)
    .where(
      and(
        eq(discountsTable.tenantId, DEFAULT_TENANT_ID),
        eq(discountsTable.method, "code"),
        inArray(discountsTable.code, [...codes]),
      ),
    );
}

/** Automatic discounts switched on and within their dates. */
export async function listLiveAutomaticDiscountRows(
  database: DatabaseOrTransaction,
  now: Date,
): Promise<DiscountRow[]> {
  const discountsTable = tableFor(database, discountsDefinition);
  return database
    .select()
    .from(discountsTable)
    .where(
      and(
        eq(discountsTable.tenantId, DEFAULT_TENANT_ID),
        eq(discountsTable.method, "automatic"),
        eq(discountsTable.enabled, true),
        lte(discountsTable.startsAt, now),
        or(isNull(discountsTable.endsAt), gt(discountsTable.endsAt, now)),
      ),
    );
}

export async function insertDiscount(
  database: DatabaseOrTransaction,
  discount: NewDiscountRow,
): Promise<DiscountRow> {
  const discountsTable = tableFor(database, discountsDefinition);
  const [inserted] = await insertReturning(database, discountsTable, discount);
  if (!inserted) throw new Error("Saving the discount returned nothing");
  return inserted;
}

export async function updateDiscountRow(
  database: DatabaseOrTransaction,
  discountId: string,
  changes: Partial<NewDiscountRow>,
): Promise<void> {
  const discountsTable = tableFor(database, discountsDefinition);
  await database
    .update(discountsTable)
    .set(changes)
    .where(and(eq(discountsTable.tenantId, DEFAULT_TENANT_ID), eq(discountsTable.id, discountId)));
}

export async function deleteDiscountRow(
  database: DatabaseOrTransaction,
  discountId: string,
): Promise<boolean> {
  const discountsTable = tableFor(database, discountsDefinition);
  const deleted = await deleteReturning(
    database,
    discountsTable,
    and(eq(discountsTable.tenantId, DEFAULT_TENANT_ID), eq(discountsTable.id, discountId)),
    { id: discountsTable.id },
  );
  return deleted.length > 0;
}

/**
 * Locks discounts until the transaction ends, so two checkouts taking the last use of a
 * limited code are counted one after the other rather than both seeing it free.
 */
export async function lockDiscountRows(
  database: DatabaseOrTransaction,
  discountIds: readonly string[],
): Promise<DiscountRow[]> {
  const discountsTable = tableFor(database, discountsDefinition);
  if (discountIds.length === 0) return [];
  return database
    .select()
    .from(discountsTable)
    .where(inArray(discountsTable.id, [...discountIds]))
    .orderBy(asc(discountsTable.id))
    .for("update");
}

/**
 * A use counts once the order is placed, and while its checkout is still open and within
 * its time; an abandoned checkout's hold stops counting by itself.
 */
function countedUse(database: DatabaseOrTransaction, now: Date): SQL | undefined {
  const checkoutsTable = tableFor(database, checkoutsDefinition);
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  // Built from columns rather than raw SQL: a column turns `now` into what the driver takes,
  // and the Postgres server's driver refuses a plain Date, which the built-in database accepts.
  return or(
    eq(discountRedemptionsTable.status, "used"),
    and(
      eq(discountRedemptionsTable.status, "held"),
      eq(checkoutsTable.status, "open"),
      gt(checkoutsTable.expiresAt, now),
    ),
  );
}

export async function countDiscountUsage(
  database: DatabaseOrTransaction,
  discountIds: readonly string[],
  email: string | null,
  now: Date,
): Promise<Map<string, DiscountUsage>> {
  const checkoutsTable = tableFor(database, checkoutsDefinition);
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  const usage = new Map<string, DiscountUsage>();
  if (discountIds.length === 0) return usage;
  const rows = await database
    .select({
      discountId: discountRedemptionsTable.discountId,
      total: sql<number>`count(*)`.mapWith(Number),
      byCustomer: countWhere(database, eq(discountRedemptionsTable.email, email ?? "")),
    })
    .from(discountRedemptionsTable)
    .leftJoin(checkoutsTable, eq(checkoutsTable.id, discountRedemptionsTable.checkoutId))
    .where(
      and(
        inArray(discountRedemptionsTable.discountId, [...discountIds]),
        countedUse(database, now),
      ),
    )
    .groupBy(discountRedemptionsTable.discountId);
  for (const row of rows) {
    usage.set(row.discountId, { total: Number(row.total), byCustomer: Number(row.byCustomer) });
  }
  return usage;
}

export async function insertRedemption(
  database: DatabaseOrTransaction,
  redemption: { discountId: string; checkoutId: string; email: string },
): Promise<void> {
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  await insertIfNew(database, discountRedemptionsTable, {
    ...redemption,
    tenantId: DEFAULT_TENANT_ID,
  });
}

/** The checkout became an order: its holds become uses. */
export async function markRedemptionsUsed(
  database: DatabaseOrTransaction,
  checkoutId: string,
  orderId: string,
): Promise<void> {
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  await database
    .update(discountRedemptionsTable)
    .set({ status: "used", orderId })
    .where(eq(discountRedemptionsTable.checkoutId, checkoutId));
}

export async function releaseRedemptions(
  database: DatabaseOrTransaction,
  checkoutId: string,
): Promise<void> {
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  await database
    .update(discountRedemptionsTable)
    .set({ status: "released" })
    .where(
      and(
        eq(discountRedemptionsTable.checkoutId, checkoutId),
        eq(discountRedemptionsTable.status, "held"),
      ),
    );
}

/** Which of the collections given each product is in, for products in a cart. */
export async function findCollectionsOfProducts(
  database: DatabaseOrTransaction,
  collectionIds: readonly string[],
  productIds: readonly string[],
  primaryCurrency: string | null,
): Promise<Map<string, Set<string>>> {
  const productCollectionItemsTable = tableFor(database, productCollectionItemsDefinition);
  const productCollectionsTable = tableFor(database, productCollectionsDefinition);
  const productsTable = tableFor(database, productsDefinition);
  const membership = new Map<string, Set<string>>();
  if (collectionIds.length === 0 || productIds.length === 0) return membership;
  const add = (productId: string, collectionId: string) => {
    const set = membership.get(productId) ?? new Set<string>();
    set.add(collectionId);
    membership.set(productId, set);
  };
  const picked = await database
    .select({
      productId: productCollectionItemsTable.productId,
      collectionId: productCollectionItemsTable.collectionId,
    })
    .from(productCollectionItemsTable)
    .where(
      and(
        inArray(productCollectionItemsTable.collectionId, [...collectionIds]),
        inArray(productCollectionItemsTable.productId, [...productIds]),
      ),
    );
  picked.forEach((row) => add(row.productId, row.collectionId));

  const automatic = await database
    .select()
    .from(productCollectionsTable)
    .where(
      and(
        inArray(productCollectionsTable.id, [...collectionIds]),
        eq(productCollectionsTable.kind, "automatic"),
      ),
    );
  for (const collection of automatic) {
    const matching = await database
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(
        and(
          inArray(productsTable.id, [...productIds]),
          collectionRulesCondition(
            database,
            collection.rules,
            collection.matchAll,
            primaryCurrency,
          ),
        ),
      );
    matching.forEach((row) => add(row.id, collection.id));
  }
  return membership;
}

/** How many orders have used each discount. */
export async function countUsedRedemptions(
  database: DatabaseOrTransaction,
  discountIds: readonly string[],
): Promise<Map<string, number>> {
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  if (discountIds.length === 0) return new Map();
  const rows = await database
    .select({
      discountId: discountRedemptionsTable.discountId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(discountRedemptionsTable)
    .where(
      and(
        inArray(discountRedemptionsTable.discountId, [...discountIds]),
        eq(discountRedemptionsTable.status, "used"),
      ),
    )
    .groupBy(discountRedemptionsTable.discountId);
  return new Map(rows.map((row) => [row.discountId, Number(row.count)]));
}
