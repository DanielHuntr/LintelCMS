import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";

/**
 * What the browser's WebAuthn call returned. Its inside is checked by the WebAuthn library
 * (signatures, origin, challenge), so here it only has to be an object.
 */
const browserResponse = <Shape>() =>
  z.custom<Shape>((value) => typeof value === "object" && value !== null && "id" in value, {
    error: "The passkey response is missing",
  });

export const addPasskeyRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Please name the passkey" })
    .max(60, { error: "Names can be at most 60 characters" })
    .default("Passkey"),
  response: browserResponse<RegistrationResponseJSON>(),
});

export const passkeySignInRequestSchema = z.object({
  response: browserResponse<AuthenticationResponseJSON>(),
});

export const passkeyIdParamsSchema = z.object({ id: z.uuid() });

export const passkeyResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type AddPasskeyRequest = z.infer<typeof addPasskeyRequestSchema>;
export type PasskeyResponse = z.infer<typeof passkeyResponseSchema>;
