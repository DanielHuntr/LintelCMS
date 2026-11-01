import type { Database } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { listMarketRows } from "../markets/markets.repository.js";
import type { DiscountProvider } from "./discount-provider.js";
import { selectDiscounts } from "./discount-selection.js";
import {
  countDiscountUsage,
  findCollectionsOfProducts,
  listDiscountRowsByCodes,
  listLiveAutomaticDiscountRows,
} from "./discounts.repository.js";

/**
 * The default discount provider: the codes and automatic discounts made in Shop →
 * Discounts. Loads what a cart could use in a handful of queries, then leaves the
 * decisions to discount-selection.ts.
 */
export function storedDiscounts(database: () => Database, now: () => Date): DiscountProvider {
  return {
    async findDiscounts(request) {
      const at = now();
      const codes = request.codes.map((code) => code.toUpperCase());
      const coded = await listDiscountRowsByCodes(database(), codes);
      const automatic = await listLiveAutomaticDiscountRows(database(), at);
      if (coded.length === 0 && automatic.length === 0) {
        return selectDiscounts(
          request,
          { byCode: new Map(), automatic: [], usage: new Map(), collectionsByProduct: new Map() },
          at,
        );
      }
      const all = [...coded, ...automatic];
      const collectionIds = [...new Set(all.flatMap((row) => row.collectionIds))];
      const markets = await listMarketRows(database(), DEFAULT_TENANT_ID);
      const primaryCurrency = markets.find((market) => market.isPrimary)?.currency ?? null;
      return selectDiscounts(
        request,
        {
          byCode: new Map(coded.map((row) => [row.code ?? "", row])),
          automatic,
          usage: await countDiscountUsage(
            database(),
            all.map((row) => row.id),
            request.email,
            at,
          ),
          collectionsByProduct: await findCollectionsOfProducts(
            database(),
            collectionIds,
            request.lines.map((line) => line.productId),
            primaryCurrency,
          ),
        },
        at,
      );
    },
  };
}
