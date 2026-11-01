import { useMemo } from "react";
import { useProductCollections } from "./discounts.queries.js";
import type { SummaryContext } from "./discountSummary.js";
import { useProducts } from "./shop.queries.js";
import { usePrimaryCurrency } from "./shopSettings.queries.js";

/** What a discount's summary needs: the shop's currency and the names of what it's for. */
export function useSummaryContext(): SummaryContext | null {
  const currency = usePrimaryCurrency();
  const products = useProducts({});
  const collections = useProductCollections();
  return useMemo(() => {
    if (!currency) return null;
    return {
      currency,
      productNames: new Map(
        (products.data?.items ?? []).map((product) => [product.id, product.title]),
      ),
      collectionNames: new Map(
        (collections.data ?? []).map((collection) => [collection.id, collection.title]),
      ),
      now: new Date(),
    };
  }, [currency, products.data, collections.data]);
}
