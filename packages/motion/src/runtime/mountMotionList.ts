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
  /** Whether any animation plays when the visitor leaves the page. */
  hasPageExits: boolean;
  /** Plays every page-exit animation and resolves when they have all finished. */
  exitPage(): Promise<void>;
  /** Puts page-exit animations back to their start, for a page the browser brings back. */
  resetPageExits(): void;
  destroy(): void;
}

export function mountMotionList(
  bindings: readonly MotionBinding[],
  options: MountOptions & { document?: Document } = {},
): PageMotion {
  const document =
    options.document ?? (typeof window === "undefined" ? undefined : window.document);
  if (!document)
    return {
      controllers: [],
      hasPageExits: false,
      exitPage: () => Promise.resolve(),
      resetPageExits: () => undefined,
      destroy: () => undefined,
    };
  const attribute = options.nodeAttribute ?? "data-node-id";
  const mounted = bindings.flatMap((binding) => {
    const escaped = binding.nodeId.replace(/["\\]/g, "\\$&");
    const element = document.querySelector(`[${attribute}="${escaped}"]`);
    if (!(element instanceof HTMLElement)) return [];
    return [{ spec: binding.spec, controller: mountMotion(element, binding.spec, options) }];
  });
  const exits = mounted.filter(({ spec }) => spec.trigger.type === "pageExit");
  return {
    controllers: mounted.map(({ controller }) => controller),
    hasPageExits: exits.length > 0,
    exitPage: async () => {
      await Promise.all(exits.map(({ controller }) => controller.exit()));
    },
    resetPageExits: () => exits.forEach(({ controller }) => controller.reset()),
    destroy: () => mounted.forEach(({ controller }) => controller.destroy()),
  };
}
