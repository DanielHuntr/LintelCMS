import { z } from "zod";

/**
 * An effect saved on an element: which one, and its settings. The settings are checked
 * against the effect's own list when the page is drawn (see resolveNodeEffects), so an
 * effect that a later version renames or removes is simply skipped.
 */
export const maxEffectsPerElement = 6;

export const nodeEffectSchema = z.object({
  effect: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "An effect should be a name like “magnetic-pull”" })
    .max(80),
  params: z
    .record(
      z.string().regex(/^[A-Za-z][\w]{0,39}$/),
      z.union([z.number().finite(), z.string().max(400), z.boolean()]),
    )
    .default({}),
});

export const nodeEffectsSchema = z.array(nodeEffectSchema).max(maxEffectsPerElement, {
  error: `An element can have at most ${maxEffectsPerElement} effects`,
});

export type NodeEffect = z.output<typeof nodeEffectSchema>;
