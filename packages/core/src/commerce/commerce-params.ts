import { z } from "zod";
import { ShopRecordNotFoundError } from "./commerce.errors.js";

const uuidSchema = z.uuid();

/**
 * Reads an id from the route's params. An id that isn't even a UUID can't name anything,
 * so it gets the same 404 as one that doesn't exist: "That order doesn't exist."
 */
export function readIdParam(params: unknown, thing: string, name = "id"): string {
  const value =
    typeof params === "object" && params !== null ? Reflect.get(params, name) : undefined;
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ShopRecordNotFoundError(thing);
  }
  return parsed.data;
}

export const pageQuerySchema = z.object({
  page: z.coerce.number({ error: "The page should be a number" }).int().min(1).default(1),
  perPage: z.coerce
    .number({ error: "perPage should be a number" })
    .int()
    .min(1)
    .max(100)
    .default(25),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;
