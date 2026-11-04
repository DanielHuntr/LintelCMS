import { z } from "zod";

/**
 * An effect saved on an element: which one, and its settings. The settings are checked
 * against the effect's own list when the page is drawn (see resolveNodeEffects), so an
 * effect that a later version renames or removes is simply skipped.
 */
export const maxEffectsPerElement = 6;

/** The most layers a section's background can have. */
export const maxShaderLayers = 6;

export const blendModes = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
  "add",
  "difference",
] as const;

export const reactSources = ["pointerX", "pointerY", "pointerNear", "scroll", "timeline"] as const;

const effectId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "An effect should be a name like “magnetic-pull”" })
  .max(80);

const settingName = z.string().regex(/^[A-Za-z][\w]{0,39}$/);

const effectParams = z
  .record(settingName, z.union([z.number().finite(), z.string().max(400), z.boolean()]))
  .default({});

/** A number setting driven by the pointer, scrolling or a timeline, from its value to `to`. */
export const settingReactSchema = z.object({
  source: z.enum(reactSources),
  to: z.number().finite(),
  /** A timeline's length. */
  seconds: z.number().min(1).max(60).optional(),
});

const settingReacts = z.record(settingName, settingReactSchema);

/** One layer of a section's background; a custom one names its shader in the site's library. */
export const shaderLayerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  effect: effectId,
  shader: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional(),
  params: effectParams,
  blend: z.enum(blendModes).default("normal"),
  opacity: z.number().min(0).max(1).default(1),
  hidden: z.boolean().optional(),
  reacts: settingReacts.optional(),
});

export const nodeEffectSchema = z.object({
  effect: effectId,
  params: effectParams,
  /** Number settings that react to something; older effects have none. */
  reacts: settingReacts.optional(),
  /** For a layered background, from the bottom up. */
  layers: z.array(shaderLayerSchema).max(maxShaderLayers).optional(),
});

export const nodeEffectsSchema = z.array(nodeEffectSchema).max(maxEffectsPerElement, {
  error: `An element can have at most ${maxEffectsPerElement} effects`,
});

export type NodeEffect = z.output<typeof nodeEffectSchema>;
export type ShaderLayer = z.output<typeof shaderLayerSchema>;
export type SettingReactInput = z.output<typeof settingReactSchema>;
export type BlendMode = (typeof blendModes)[number];
export type ReactSourceName = (typeof reactSources)[number];
