import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dryRunShopifyImport,
  getShopifyImport,
  type ImportOptions,
  listArchivedOrders,
  listShopifyImports,
  runShopifyImportBatch,
  saveImportOptions,
  type ShopifyImport,
  startShopifyImport,
} from "./shopifyImport.api.js";

/** TanStack Query hooks for moving from Shopify. */

export const importKeys = {
  all: () => ["shop", "imports"] as const,
  one: (importId: string) => ["shop", "imports", importId] as const,
  archived: (customerId: string) => ["shop", "archived-orders", customerId] as const,
};

export function useShopifyImports() {
  return useQuery({ queryKey: importKeys.all(), queryFn: listShopifyImports });
}

export function useShopifyImport(importId: string | null) {
  return useQuery({
    queryKey: importKeys.one(importId ?? ""),
    queryFn: () => getShopifyImport(importId ?? ""),
    enabled: importId !== null,
  });
}

/** Every change answers with the whole import, which replaces the cached one. */
function useImportChange<Input>(change: (input: Input) => Promise<ShopifyImport>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (updated) => {
      queryClient.setQueryData(importKeys.one(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: importKeys.all(), exact: true });
    },
  });
}

export function useStartShopifyImport() {
  return useImportChange(startShopifyImport);
}

/** Choices show as soon as they're made; the server's answer then replaces them. */
export function useSaveImportOptions(importId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: ImportOptions) => saveImportOptions(importId, options),
    onMutate: (options) => {
      const previous = queryClient.getQueryData<ShopifyImport>(importKeys.one(importId));
      if (previous) queryClient.setQueryData(importKeys.one(importId), { ...previous, options });
      return { previous };
    },
    onError: (_error, _options, context) => {
      if (context?.previous) queryClient.setQueryData(importKeys.one(importId), context.previous);
    },
    onSuccess: (updated) => queryClient.setQueryData(importKeys.one(updated.id), updated),
  });
}

export function useDryRun(importId: string) {
  return useImportChange(() => dryRunShopifyImport(importId));
}

export function useRunBatch(importId: string) {
  return useImportChange(() => runShopifyImportBatch(importId));
}

export function useArchivedOrders(customerId: string) {
  return useQuery({
    queryKey: importKeys.archived(customerId),
    queryFn: () => listArchivedOrders(customerId),
  });
}
