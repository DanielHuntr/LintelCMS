import { mountEffect, mountMotion, setEffectModuleAddresses } from "@lintel/motion";
import { effectAnimation, type EffectDefinition } from "@lintel/motion/effects";
import { useCallback, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../preview/usePrefersReducedMotion.js";

/**
 * Runs an effect on a stand-in element for as long as `start` has been called and `stop`
 * hasn't: the real behaviour, loaded from the same module the website uses, so pointer
 * effects respond to the pointer over the card. Animation effects play their animation.
 * With reduced motion on, the reduced version runs, as visitors would see it.
 */
export function useEffectPreview(
  definition: EffectDefinition,
  props: Readonly<Record<string, number | string | boolean>>,
  moduleAddresses: Readonly<Record<string, string>> | undefined,
) {
  const root = useRef<HTMLElement | null>(null);
  const undo = useRef<(() => void) | null>(null);
  const reduced = usePrefersReducedMotion();
  const stop = useCallback(() => {
    undo.current?.();
    undo.current = null;
  }, []);
  const start = useCallback(() => {
    stop();
    const element = root.current;
    if (!element) return;
    if (definition.kind === "animation") {
      const controller = mountMotion(element, effectAnimation(definition, props), {
        mode: "manual",
      });
      controller.restart();
      undo.current = () => controller.destroy();
    } else if (definition.kind === "behaviour" && moduleAddresses) {
      let stopped = false;
      let cleanup: (() => void) | null = null;
      undo.current = () => {
        stopped = true;
        cleanup?.();
      };
      setEffectModuleAddresses(moduleAddresses);
      const params = { ...definition.fixed, ...props };
      const context = { reduced, lowPower: false, finePointer: true };
      void mountEffect(
        element,
        { module: definition.module, behaviour: definition.behaviour, params },
        context,
      ).then((done: () => void) => {
        if (stopped) return done();
        cleanup = done;
        // The stand-in is a picture: anything the effect made focusable stays out of the tab order.
        [element, ...element.querySelectorAll("[tabindex]")].forEach((node) =>
          node.setAttribute("tabindex", "-1"),
        );
      });
    }
  }, [definition, props, moduleAddresses, reduced, stop]);
  useEffect(() => stop, [stop]);
  const rootRef = useCallback((element: HTMLElement | null) => {
    root.current = element;
  }, []);
  return { rootRef, start, stop };
}
