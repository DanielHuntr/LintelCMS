import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDiscount,
  deleteDiscount,
  type DiscountInput,
  getDiscount,
  listDiscounts,
  listProductCollections,
  saveDiscount,
} from "./discounts.api.js";

/** TanStack Query hooks for Shop → Discounts. */

export const discountKeys = {
  all: () => ["shop", "discounts"] as const,
  one: (discountId: string) => ["shop", "discounts", discountId] as const,
  collections: () => ["shop", "collections"] as const,
};

export function useDiscounts() {
  return useQuery({ queryKey: discountKeys.all(), queryFn: listDiscounts });
}

export function useDiscount(discountId: string | null) {
  return useQuery({
    queryKey: discountKeys.one(discountId ?? "new"),
    queryFn: () => getDiscount(discountId ?? ""),
    enabled: discountId !== null,
  });
}

export function useSaveDiscount(discountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (discount: DiscountInput) =>
      discountId ? saveDiscount(discountId, discount) : createDiscount(discount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: discountKeys.all() }),
  });
}

export function useDeleteDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDiscount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: discountKeys.all() }),
  });
}

export function useProductCollections() {
  return useQuery({ queryKey: discountKeys.collections(), queryFn: listProductCollections });
}
