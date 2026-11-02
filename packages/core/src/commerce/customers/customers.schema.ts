import { z } from "zod";
import { addressSchema } from "./address.schema.js";

export const listCustomersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

/** `PATCH /shop/customers/:id`. The email is the customer's key, so it isn't changed here. */
export const updateCustomerRequestSchema = z.object({
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  note: z.string().trim().max(5000).optional(),
});

const moneySchema = z.object({ amount: z.number().int(), currency: z.string() });

export const customerSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  note: z.string(),
  addresses: z.array(addressSchema),
  orderCount: z.number().int(),
  /** Includes orders from before the move (Shopify), net of refunds, without cancelled ones. */
  totalSpent: z.array(moneySchema),
  createdAt: z.iso.datetime(),
  /** The earlier of `createdAt` and their first order from before the move. */
  customerSince: z.iso.datetime(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
export type UpdateCustomerRequest = z.infer<typeof updateCustomerRequestSchema>;
export type Customer = z.infer<typeof customerSchema>;
