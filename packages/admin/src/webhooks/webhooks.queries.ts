import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  listWebhookDeliveries,
  listWebhooks,
  resendWebhookDelivery,
  updateWebhook,
  type WebhookChanges,
} from "./webhooks.api.js";

export const webhookKeys = {
  all: () => ["webhooks"] as const,
  list: () => ["webhooks", "list"] as const,
  webhook: (webhookId: string) => ["webhooks", webhookId] as const,
  deliveries: (webhookId: string) => ["webhooks", webhookId, "deliveries"] as const,
};

export function useWebhooks() {
  return useQuery({ queryKey: webhookKeys.list(), queryFn: listWebhooks });
}

export function useWebhook(webhookId: string) {
  return useQuery({
    queryKey: webhookKeys.webhook(webhookId),
    queryFn: () => getWebhook(webhookId),
  });
}

/** The log refreshes while anything in it is still waiting to be sent. */
export function useWebhookDeliveries(webhookId: string) {
  return useQuery({
    queryKey: webhookKeys.deliveries(webhookId),
    queryFn: () => listWebhookDeliveries(webhookId),
    refetchInterval: (query) =>
      query.state.data?.deliveries.some((delivery) => delivery.status === "pending") ? 5000 : false,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWebhook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhookKeys.list() }),
  });
}

export function useUpdateWebhook(webhookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: WebhookChanges) => updateWebhook(webhookId, changes),
    onSuccess: (webhook) => {
      queryClient.setQueryData(webhookKeys.webhook(webhookId), webhook);
      return queryClient.invalidateQueries({ queryKey: webhookKeys.list() });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhookKeys.all() }),
  });
}

export function useResendDelivery(webhookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => resendWebhookDelivery(webhookId, deliveryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhookKeys.webhook(webhookId) }),
  });
}
