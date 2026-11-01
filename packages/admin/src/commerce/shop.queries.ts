import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addOrderNote,
  cancelOrder,
  fulfilOrder,
  type FulfilmentInput,
  getCustomer,
  getOrder,
  getSalesSummary,
  listCustomers,
  listOrders,
  type OrderFilter,
  refundOrder,
  type RefundInput,
  updateCustomer,
} from "./orders.api.js";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listLocations,
  listProducts,
  type ProductInput,
  type ProductListQuery,
  saveProduct,
} from "./products.api.js";

/** TanStack Query hooks for the catalogue, orders and customers. Settings have their own. */

export const shopKeys = {
  all: () => ["shop"] as const,
  products: () => ["shop", "products"] as const,
  productList: (query: ProductListQuery) => ["shop", "products", "list", query] as const,
  product: (productId: string) => ["shop", "products", productId] as const,
  locations: () => ["shop", "locations"] as const,
  orders: () => ["shop", "orders"] as const,
  orderList: (filter: object) => ["shop", "orders", "list", filter] as const,
  order: (orderId: string) => ["shop", "orders", orderId] as const,
  customers: () => ["shop", "customers"] as const,
  customer: (customerId: string) => ["shop", "customers", customerId] as const,
  sales: (days: number) => ["shop", "sales", days] as const,
};

export function useProducts(query: ProductListQuery) {
  return useQuery({ queryKey: shopKeys.productList(query), queryFn: () => listProducts(query) });
}

export function useProduct(productId: string | null) {
  return useQuery({
    queryKey: shopKeys.product(productId ?? "new"),
    queryFn: () => getProduct(productId ?? ""),
    enabled: productId !== null,
  });
}

export function useLocations() {
  return useQuery({ queryKey: shopKeys.locations(), queryFn: listLocations });
}

export function useSaveProduct(productId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: ProductInput) =>
      productId ? saveProduct(productId, product) : createProduct(product),
    onSuccess: (saved) => {
      queryClient.setQueryData(shopKeys.product(saved.id), saved);
      return queryClient.invalidateQueries({ queryKey: [...shopKeys.products(), "list"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shopKeys.products() }),
  });
}

export function useOrders(filter: { view?: OrderFilter; search?: string; customerId?: string }) {
  return useQuery({ queryKey: shopKeys.orderList(filter), queryFn: () => listOrders(filter) });
}

export function useOrder(orderId: string) {
  return useQuery({ queryKey: shopKeys.order(orderId), queryFn: () => getOrder(orderId) });
}

/** Every change to an order answers with the whole order, which replaces the cached one. */
function useOrderChange<Input>(
  orderId: string,
  change: (input: Input) => ReturnType<typeof getOrder>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (order) => {
      queryClient.setQueryData(shopKeys.order(orderId), order);
      void queryClient.invalidateQueries({ queryKey: [...shopKeys.orders(), "list"] });
      void queryClient.invalidateQueries({ queryKey: shopKeys.products() });
    },
  });
}

export function useRefundOrder(orderId: string) {
  return useOrderChange(orderId, (refund: RefundInput) => refundOrder(orderId, refund));
}

export function useFulfilOrder(orderId: string) {
  return useOrderChange(orderId, (fulfilment: FulfilmentInput) => fulfilOrder(orderId, fulfilment));
}

export function useCancelOrder(orderId: string) {
  return useOrderChange(orderId, (cancel: { reason: string; refund: boolean; restock: boolean }) =>
    cancelOrder(orderId, cancel),
  );
}

export function useAddOrderNote(orderId: string) {
  return useOrderChange(orderId, (message: string) => addOrderNote(orderId, message));
}

export function useCustomers(search: string) {
  return useQuery({
    queryKey: [...shopKeys.customers(), "list", search],
    queryFn: () => listCustomers(search),
  });
}

export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: shopKeys.customer(customerId),
    queryFn: () => getCustomer(customerId),
  });
}

export function useUpdateCustomer(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: { note?: string }) => updateCustomer(customerId, changes),
    onSuccess: (customer) => queryClient.setQueryData(shopKeys.customer(customerId), customer),
  });
}

export function useSalesSummary(days = 30) {
  return useQuery({ queryKey: shopKeys.sales(days), queryFn: () => getSalesSummary(days) });
}
