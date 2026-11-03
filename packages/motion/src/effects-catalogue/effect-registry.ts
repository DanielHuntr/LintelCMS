import { standardEffects } from "./catalogue/index.js";
import {
  InvalidEffectError,
  type EffectDefinition,
  type ElementKind,
} from "./effect-definition.js";

/**
 * The effects on offer: Lintel's own and any that code registers (`registerEffect`). The
 * gallery lists them, the renderer turns saved effects into what the page runs, and the
 * page weight meter adds them up, all from the same list.
 */
export interface EffectRegistry {
  all(): readonly EffectDefinition[];
  find(id: string): EffectDefinition | undefined;
  /** Adds an effect. Throws InvalidEffectError if one with the same id is already there. */
  register(definition: EffectDefinition): void;
  /**
   * Effects the gallery offers for an element of this kind (leaving out those set with a
   * field of their own, `listed: false`).
   */
  suiting(kind: ElementKind): readonly EffectDefinition[];
}

export function createEffectRegistry(
  initial: readonly EffectDefinition[] = standardEffects,
): EffectRegistry {
  const byId = new Map<string, EffectDefinition>();
  const registry: EffectRegistry = {
    all: () => [...byId.values()],
    find: (id) => byId.get(id),
    register: (definition) => {
      if (byId.has(definition.id)) {
        throw new InvalidEffectError(definition.id, "another effect already has that id");
      }
      byId.set(definition.id, definition);
    },
    suiting: (kind) =>
      registry
        .all()
        .filter(
          (definition) =>
            definition.listed !== false &&
            (definition.suits.includes("any") || kind === "any" || definition.suits.includes(kind)),
        ),
  };
  initial.forEach(registry.register);
  return registry;
}

/** The registry the builder and the website share; plugins add to it when they load. */
export const effectRegistry = createEffectRegistry();

/** Adds an effect to the shared registry, so the gallery offers it. */
export function registerEffect(definition: EffectDefinition): void {
  effectRegistry.register(definition);
}
