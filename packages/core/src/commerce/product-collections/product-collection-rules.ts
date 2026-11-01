import { and, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { productsTable, variantPricesTable, variantsTable } from "../products/products.table.js";
import type { CollectionRule } from "./product-collections.table.js";

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
  rules: readonly CollectionRule[],
  matchAll: boolean,
  primaryCurrency: string | null,
): SQL {
  if (rules.length === 0) {
    // An automatic collection with no rules yet holds nothing, rather than everything.
    return sql`false`;
  }
  const conditions = rules.map((rule) => ruleCondition(rule, primaryCurrency));
  return (matchAll ? and(...conditions) : or(...conditions)) ?? sql`false`;
}

function ruleCondition(rule: CollectionRule, primaryCurrency: string | null): SQL {
  const pattern = `%${rule.value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  switch (rule.field) {
    case "tag":
      return rule.operator === "equals"
        ? sql`${productsTable.tags} @> ${JSON.stringify([rule.value])}::jsonb`
        : sql`exists (select 1 from jsonb_array_elements_text(${productsTable.tags}) as tag where tag ilike ${pattern})`;
    case "title":
    case "vendor":
    case "productType": {
      const column = productsTable[rule.field];
      return rule.operator === "equals"
        ? sql`lower(${column}) = lower(${rule.value})`
        : ilike(column, pattern);
    }
    case "price":
      return priceCondition(rule, primaryCurrency);
  }
}

function priceCondition(rule: CollectionRule, primaryCurrency: string | null): SQL {
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
