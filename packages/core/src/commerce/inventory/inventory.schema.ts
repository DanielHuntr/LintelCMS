import { z } from "zod";

const locationNameSchema = z
  .string({ error: "Please give the location a name" })
  .trim()
  .min(1, { error: "Please give the location a name" })
  .max(100, { error: "Location names can be at most 100 characters" });

export const createLocationRequestSchema = z.object({ name: locationNameSchema });

export const updateLocationRequestSchema = z.object({
  name: locationNameSchema.optional(),
  isActive: z.boolean({ error: "isActive should be true or false" }).optional(),
});

export const inventoryLocationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isActive: z.boolean(),
});

export type CreateLocationRequest = z.infer<typeof createLocationRequestSchema>;
export type UpdateLocationRequest = z.infer<typeof updateLocationRequestSchema>;
export type InventoryLocation = z.infer<typeof inventoryLocationSchema>;
