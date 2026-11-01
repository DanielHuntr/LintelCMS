import { z } from "zod";
import { securityEventKinds } from "./security-events.table.js";

export const listSecurityEventsQuerySchema = z.object({
  kind: z.enum(securityEventKinds, { error: "That isn't a kind of security event" }).optional(),
  page: z.coerce.number({ error: "The page should be a number" }).int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export const securityEventResponseSchema = z.object({
  id: z.uuid(),
  kind: z.enum(securityEventKinds),
  createdAt: z.string(),
  actor: z.object({ id: z.uuid().nullable(), email: z.string().nullable() }),
  subject: z.object({ id: z.uuid().nullable(), name: z.string().nullable() }).nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type ListSecurityEventsQuery = z.infer<typeof listSecurityEventsQuerySchema>;
export type SecurityEventResponse = z.infer<typeof securityEventResponseSchema>;
