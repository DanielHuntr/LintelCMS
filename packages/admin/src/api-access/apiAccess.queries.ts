import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createApiToken,
  deleteApiToken,
  getDeliveryAccess,
  listApiTokens,
  updateDeliveryAccess,
} from "./apiAccess.api.js";

export const apiAccessKeys = {
  tokens: () => ["api-tokens"] as const,
  deliveryAccess: () => ["delivery-access"] as const,
};

export function useApiTokens() {
  return useQuery({ queryKey: apiAccessKeys.tokens(), queryFn: listApiTokens });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createApiToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiAccessKeys.tokens() }),
  });
}

export function useDeleteApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteApiToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiAccessKeys.tokens() }),
  });
}

export function useDeliveryAccess() {
  return useQuery({ queryKey: apiAccessKeys.deliveryAccess(), queryFn: getDeliveryAccess });
}

export function useUpdateDeliveryAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateDeliveryAccess,
    onSuccess: (access) => queryClient.setQueryData(apiAccessKeys.deliveryAccess(), access),
  });
}
