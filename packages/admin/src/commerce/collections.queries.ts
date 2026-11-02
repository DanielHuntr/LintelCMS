import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProductCollection,
  getProductCollection,
  inputFromCollection,
  type ProductCollection,
  type ProductCollectionInput,
  saveProductCollection,
} from "./collections.api.js";
import { discountKeys, useProductCollections } from "./discounts.queries.js";

/** TanStack Query hooks for Shop → Collections, and a product's place in them. */

export const collectionKeys = {
  /** The list (shared with the discount editor's picker) and every collection under it. */
  all: discountKeys.collections,
  one: (collectionId: string) => ["shop", "collections", collectionId] as const,
};

export function useProductCollection(collectionId: string | null) {
  return useQuery({
    queryKey: collectionKeys.one(collectionId ?? "new"),
    queryFn: () => getProductCollection(collectionId ?? ""),
    enabled: collectionId !== null,
  });
}

export function useSaveProductCollection(collectionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (collection: ProductCollectionInput) =>
      collectionId
        ? saveProductCollection(collectionId, collection)
        : createProductCollection(collection),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionKeys.all() }),
  });
}

/**
 * The collections picked by hand, each with its products, so a product's editor can show
 * which ones it's in. Undefined until all of them have loaded.
 */
export function useManualCollections(): ProductCollection[] | undefined {
  const list = useProductCollections();
  const manual = (list.data ?? []).filter((collection) => collection.kind === "manual");
  const details = useQueries({
    queries: manual.map((collection) => ({
      queryKey: collectionKeys.one(collection.id),
      queryFn: () => getProductCollection(collection.id),
    })),
  });
  if (!list.data || details.some((detail) => !detail.data)) return undefined;
  return details.flatMap((detail) => (detail.data ? [detail.data] : []));
}

/** Puts a product into the chosen hand-picked collections and takes it out of the others. */
export function useSetProductCollections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: {
      productId: string;
      chosenIds: readonly string[];
      collections: readonly ProductCollection[];
    }) => {
      for (const collection of change.collections) {
        const isIn = collection.productIds.includes(change.productId);
        const shouldBeIn = change.chosenIds.includes(collection.id);
        if (isIn === shouldBeIn) continue;
        const productIds = shouldBeIn
          ? [...collection.productIds, change.productId]
          : collection.productIds.filter((productId) => productId !== change.productId);
        await saveProductCollection(collection.id, {
          ...inputFromCollection(collection),
          productIds,
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: collectionKeys.all() }),
  });
}
