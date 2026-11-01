import type { MotionSpec } from "../spec/motion.schema.js";
import { mountMotion, type MotionController, type MountOptions } from "./mountMotion.js";

/**
 * Mounts every animation on a page, as the builder saves them: a list of node ids and specs.
 * Each node is found by the attribute the builder puts on it (`data-node-id` by default).
 */

export interface MotionBinding {
  nodeId: string;
  spec: MotionSpec;
}

export interface PageMotion {
  controllers: MotionController[];
  /** Plays every page-exit animation and resolves when they have all finished. */
  exitPage(): Promise<void>;
  destroy(): void;
}

export function mountMotionList(
  bindings: readonly MotionBinding[],
  options: MountOptions & { document?: Document } = {},
): PageMotion {
  const document =
    options.document ?? (typeof window === "undefined" ? undefined : window.document);
  if (!document)
    return { controllers: [], exitPage: () => Promise.resolve(), destroy: () => undefined };
  const attribute = options.nodeAttribute ?? "data-node-id";
  const mounted = bindings.flatMap((binding) => {
    const escaped = binding.nodeId.replace(/["\\]/g, "\\$&");
    const element = document.querySelector(`[${attribute}="${escaped}"]`);
    if (!(element instanceof HTMLElement)) return [];
    return [{ spec: binding.spec, controller: mountMotion(element, binding.spec, options) }];
  });
  return {
    controllers: mounted.map(({ controller }) => controller),
    exitPage: async () => {
      const exits = mounted.filter(({ spec }) => spec.trigger.type === "pageExit");
      await Promise.all(exits.map(({ controller }) => controller.exit()));
    },
    destroy: () => mounted.forEach(({ controller }) => controller.destroy()),
  };
}
