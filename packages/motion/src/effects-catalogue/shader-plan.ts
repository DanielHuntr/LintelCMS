import type { EffectParameterValue } from "../effects/effect-types.js";
import type { ReadShader } from "../effects/kit/custom-shader.js";
import {
  cleanProps,
  effectColourPattern,
  type BehaviourEffect,
  type EffectDefinition,
  type EffectParameter,
} from "./effect-definition.js";
import type { EffectRegistry } from "./effect-registry.js";
import type { NodeEffect, ShaderLayer } from "./node-effect.schema.js";

/**
 * Saved shader effects turned into the plan `modules/shader-stack` draws. An effect only
 * takes this path when it needs to: it has layers, a setting that reacts to something, or is
 * one of the looks that only run there. An older effect saved with none of these comes out
 * exactly as it always did. The plan travels as JSON in one setting, so it passes through
 * the page's list of effects and the builder's preview like any other.
 */

export const layeredBackgroundEffectId = "layered-background";
export const customShaderEffectId = "custom-shader";

/** The look an effect runs as in a stack, if it can. */
function lookOf(definition: EffectDefinition): string | undefined {
  if (definition.kind !== "behaviour") return undefined;
  const fixed = definition.fixed?.look;
  return definition.stackLook ?? (typeof fixed === "string" ? fixed : undefined);
}

export const isStackable = (definition: EffectDefinition): boolean =>
  lookOf(definition) !== undefined;

/** Whether this saved effect is drawn by the stack rather than its own module. */
export function usesStackRuntime(saved: NodeEffect, definition: EffectDefinition): boolean {
  if (definition.kind !== "behaviour") return false;
  if (saved.effect === layeredBackgroundEffectId) return true;
  if (!isStackable(definition)) return false;
  return definition.module === "shader-stack" || Object.keys(saved.reacts ?? {}).length > 0;
}

/** Where a layer's own opacity saves what drives it, beside its settings' reactions. */
export const layerOpacityReact = "layerOpacity";

/** Keeps only reactions to number settings, with their ends inside the setting's range. */
function cleanReacts(definition: EffectDefinition, reacts: NodeEffect["reacts"]) {
  const kept = Object.entries(reacts ?? {}).flatMap(([name, react]) => {
    if (name === layerOpacityReact) {
      return [[name, { ...react, to: Math.min(1, Math.max(0, react.to)) }] as const];
    }
    const parameter: EffectParameter | undefined = definition.params[name];
    if (parameter?.kind !== "number") return [];
    const to = Math.min(parameter.max, Math.max(parameter.min, react.to));
    return [[name, { ...react, to }] as const];
  });
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/** A custom layer's values: numbers, switches and colours, and nothing else. */
function cleanCustomValues(params: ShaderLayer["params"]) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => typeof value !== "string" || effectColourPattern.test(value),
    ),
  );
}

interface PlanOptions {
  /** A custom shader's code, for the builder's canvas, which has no list from the server. */
  codeOf?: (shaderId: string) => string | undefined;
}

function planLayer(
  layer: ShaderLayer,
  registry: EffectRegistry,
  options: PlanOptions,
): Array<Record<string, unknown>> {
  const base = {
    blend: layer.blend,
    opacity: layer.opacity,
    ...(layer.reacts ? { reacts: layer.reacts } : {}),
  };
  if (layer.effect === customShaderEffectId) {
    if (!layer.shader) return [];
    const code = options.codeOf?.(layer.shader);
    return [
      {
        ...base,
        shader: layer.shader,
        ...(code ? { code } : {}),
        values: cleanCustomValues(layer.params),
      },
    ];
  }
  const definition = registry.find(layer.effect);
  const look = definition && lookOf(definition);
  if (!definition || !look) return [];
  const reacts = cleanReacts(definition, layer.reacts);
  return [
    {
      ...base,
      look,
      values: cleanProps(definition, layer.params),
      ...(reacts ? { reacts } : { reacts: undefined }),
    },
  ];
}

/** The plan for a saved effect, as JSON; undefined when its own module runs it as before. */
export function effectPlan(
  saved: NodeEffect,
  registry: EffectRegistry,
  options: PlanOptions = {},
): string | undefined {
  const definition = registry.find(saved.effect);
  if (!definition || !usesStackRuntime(saved, definition)) return undefined;
  const layers: readonly ShaderLayer[] =
    saved.effect === layeredBackgroundEffectId
      ? (saved.layers ?? [])
      : [layerFromEffect(saved, "only")];
  const props = cleanProps(definition, saved.params);
  return JSON.stringify({
    layers: layers
      .filter((layer) => !layer.hidden)
      .flatMap((layer) => planLayer(layer, registry, options)),
    readable: props.readable !== false,
  });
}

/** A saved effect as a layer, as when "Add a layer" turns it into a stack. */
export function layerFromEffect(saved: NodeEffect, id: string): ShaderLayer {
  return {
    id,
    effect: saved.effect,
    params: saved.params,
    blend: "normal",
    opacity: 1,
    ...(saved.reacts ? { reacts: saved.reacts } : {}),
  };
}

/** The still version of a stack: its lowest visible layer that has one. */
export function stackStaticCss(
  selector: string,
  layers: readonly ShaderLayer[],
  registry: EffectRegistry,
): string {
  for (const layer of layers) {
    if (layer.hidden) continue;
    if (layer.effect === customShaderEffectId) {
      const plain = layer.params.fallback;
      if (typeof plain === "string" && effectColourPattern.test(plain)) {
        return `${selector} { background-color: ${plain}; }`;
      }
      continue;
    }
    const definition = registry.find(layer.effect);
    if (definition?.staticCss) {
      return definition.staticCss(selector, cleanProps(definition, layer.params) as never);
    }
  }
  return "";
}

/** The definitions a stack uses, for the page weight meter. */
export function stackDefinitions(
  layers: readonly ShaderLayer[],
  registry: EffectRegistry,
): EffectDefinition[] {
  return layers.flatMap((layer) => {
    const definition = registry.find(layer.effect);
    return definition && !layer.hidden ? [definition] : [];
  });
}

/** The custom shaders a binding's plan names. */
export function shaderIdsInPlan(params: Readonly<Record<string, EffectParameterValue>>): string[] {
  if (typeof params.plan !== "string") return [];
  return [...params.plan.matchAll(/"shader":"([a-z0-9-]{1,40})"/g)].map((found) => found[1]!);
}

/** A saved shader's controls as an effect's settings, so it edits like any other layer. */
export function customShaderDefinition(
  name: string,
  read: Pick<ReadShader, "controls" | "fallback">,
): BehaviourEffect {
  const params: Record<string, EffectParameter> = {};
  for (const control of read.controls) {
    if (control.kind === "slider") {
      const { label, min, max, step, value } = control;
      params[control.name] = { kind: "number", label, default: value, min, max, step };
    } else if (control.kind === "colour") {
      params[control.name] = { kind: "colour", label: control.label, default: control.value };
    } else {
      params[control.name] = { kind: "switch", label: control.label, default: control.value };
    }
  }
  params.speed = {
    kind: "number",
    label: "Speed",
    default: 1,
    min: 0,
    max: 3,
    step: 0.1,
    unit: "×",
    more: true,
  };
  params.fallback = {
    kind: "colour",
    label: "Plain background",
    default: read.fallback ?? "#808080",
    more: true,
  };
  return {
    id: customShaderEffectId,
    name,
    description: "A shader written for this site.",
    category: "canvas",
    kind: "behaviour",
    module: "shader-stack",
    behaviour: "shaderStack",
    suits: ["container"],
    params,
    reducedMotion: "A still frame.",
    preview: "card",
    weight: "heavy",
    listed: false,
  };
}
