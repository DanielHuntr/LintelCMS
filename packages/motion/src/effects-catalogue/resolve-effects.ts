import type { EffectBinding } from "../effects/effect-types.js";
import { cleanProps, type EffectDefinition } from "./effect-definition.js";
import type { EffectRegistry } from "./effect-registry.js";
import type { NodeEffect } from "./node-effect.schema.js";

/**
 * Saved effects turned into what the published page needs: the bindings the runtime
 * mounts (module, behaviour and settings) and the static CSS written into the page.
 * "animation" effects are left out: they were saved as the element's animation.
 */

export interface ResolvedEffects {
  bindings: EffectBinding[];
  css: string;
  /** The definitions used, for the page weight meter. */
  used: EffectDefinition[];
  /**
   * Attributes each element with effects carries on the published page, by node id. Every
   * one is there (empty when its effects add none), as each needs its `data-node-id`.
   */
  attributes: Map<string, Record<string, string>>;
}

export function effectSelector(nodeId: string): string {
  return `[data-node-id="${nodeId.replace(/["\\]/g, "\\$&")}"]`;
}

export function resolveNodeEffects(
  list: ReadonlyArray<{ nodeId: string; effects: readonly NodeEffect[] }>,
  registry: EffectRegistry,
  selectorFor: (nodeId: string) => string = effectSelector,
): ResolvedEffects {
  const resolved: ResolvedEffects = { bindings: [], css: "", used: [], attributes: new Map() };
  const css: string[] = [];
  for (const { nodeId, effects } of list) {
    for (const saved of effects) {
      const definition = registry.find(saved.effect);
      if (!definition || definition.kind === "animation") continue;
      const props = cleanProps(definition, saved.params);
      resolved.used.push(definition);
      resolved.attributes.set(nodeId, {
        ...resolved.attributes.get(nodeId),
        ...definition.elementAttributes?.(props as never),
      });
      if (definition.staticCss) css.push(definition.staticCss(selectorFor(nodeId), props as never));
      if (definition.kind === "behaviour") {
        resolved.bindings.push({
          nodeId,
          module: definition.module,
          behaviour: definition.module === "custom" ? definition.id : definition.behaviour,
          params: { ...definition.fixed, ...props },
        });
      }
    }
  }
  resolved.css = css.filter(Boolean).join("\n");
  return resolved;
}
