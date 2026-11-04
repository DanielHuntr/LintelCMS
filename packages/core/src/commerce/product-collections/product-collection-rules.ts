import { and, eq, or, type SQL, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  productsTable as productsDefinition,
  variantPricesTable as variantPricesDefinition,
  variantsTable as variantsDefinition,
} from "../products/products.table.js";
import type { CollectionRule } from "./product-collections.table.js";
import { jsonListIncludes, likeIgnoringCase } from "../../database/dialect/expressions.js";
import { jsonListHasItemLike } from "../../database/dialect/json-expressions.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/**
 * Turns an automatic collection's rules into one SQL condition on products, so matching
 * happens in the database however big the catalogue:
 *
 *   tag          is / contains     one of the product's tags (any case for "contains")
 *   title        is / contains     ignoring case
 *   vendor       is / contains     ignoring case
 *   productType  is / contains     ignoring case
 *   price        is / greater than / less than   any variant's price in the primary
 *                                                currency, in minor units
 */
export function collectionRulesCondition(
  database: DatabaseOrTransaction,
  rules: readonly CollectionRule[],
  matchAll: boolean,
  primaryCurrency: string | null,
): SQL {
  if (rules.length === 0) {
    // An automatic collection with no rules yet holds nothing, rather than everything.
    return sql`false`;
  }
  const conditions = rules.map((rule) => ruleCondition(database, rule, primaryCurrency));
  return (matchAll ? and(...conditions) : or(...conditions)) ?? sql`false`;
}

function ruleCondition(
  database: DatabaseOrTransaction,
  rule: CollectionRule,
  primaryCurrency: string | null,
): SQL {
  const productsTable = tableFor(database, productsDefinition);
  const pattern = `%${rule.value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  switch (rule.field) {
    case "tag":
      return rule.operator === "equals"
        ? jsonListIncludes(database, productsTable.tags, rule.value)
        : jsonListHasItemLike(database, productsTable.tags, pattern);
    case "title":
    case "vendor":
    case "productType": {
      const column = productsTable[rule.field];
      return rule.operator === "equals"
        ? sql`lower(${column}) = lower(${rule.value})`
        : likeIgnoringCase(database, column, pattern);
    }
    case "price":
      return priceCondition(database, rule, primaryCurrency);
  }
}

function priceCondition(
  database: DatabaseOrTransaction,
  rule: CollectionRule,
  primaryCurrency: string | null,
): SQL {
  const productsTable = tableFor(database, productsDefinition);
  const variantPricesTable = tableFor(database, variantPricesDefinition);
  const variantsTable = tableFor(database, variantsDefinition);
  if (!primaryCurrency) {
    return sql`false`;
  }
  const amount = Number(rule.value);
  const comparison =
    rule.operator === "greaterThan"
      ? sql`${variantPricesTable.amount} > ${amount}`
      : rule.operator === "lessThan"
        ? sql`${variantPricesTable.amount} < ${amount}`
        : eq(variantPricesTable.amount, amount);
  return sql`exists (
    select 1 from ${variantsTable}
    join ${variantPricesTable} on ${variantPricesTable.variantId} = ${variantsTable.id}
    where ${variantsTable.productId} = ${productsTable.id}
      and ${variantPricesTable.currency} = ${primaryCurrency}
      and ${comparison}
  )`;
}
