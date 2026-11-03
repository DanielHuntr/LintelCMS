import { isBrowser, prefersReducedMotion } from "../runtime/environment.js";
import {
  customModuleName,
  type EffectBehaviour,
  type EffectBinding,
  type EffectCleanup,
  type EffectContext,
  type EffectModule,
  type EffectModuleName,
  type PageEffects,
} from "./effect-types.js";

/**
 * Starts a page's effects. This part ships in the core runtime, so it stays tiny: it only
 * finds each element, waits until it comes near the screen, then imports the module that
 * runs the effect. Pages without effects never import a module; a module is fetched once
 * however many elements use it. Site-wide effects (cursor, transitions, intro) start at once.
 */

const loadedModules = new Map<string, Promise<EffectModule | undefined>>();
const customBehaviours = new Map<string, EffectBehaviour>();
const waitingForCustom = new Map<string, Array<() => void>>();
let moduleAddresses: PageEffects["modules"] = {};

/** Where each module file is, from the page's list (or the canvas's). */
export function setEffectModuleAddresses(addresses: PageEffects["modules"]): void {
  moduleAddresses = { ...moduleAddresses, ...addresses };
}

function importModule(name: EffectModuleName): Promise<EffectModule | undefined> {
  const address = moduleAddresses[name];
  if (!address) return Promise.resolve(undefined);
  let loading = loadedModules.get(address);
  if (!loading) {
    loading = (import(/* @vite-ignore */ address) as Promise<EffectModule>).catch(() => undefined);
    loadedModules.set(address, loading);
  }
  return loading;
}

/** Lets code (a code block, a plugin's script) run effects of its own: see defineEffect. */
export function registerEffectBehaviour(name: string, behaviour: EffectBehaviour): void {
  customBehaviours.set(name, behaviour);
  waitingForCustom.get(name)?.forEach((start) => start());
  waitingForCustom.delete(name);
}

export function readEffectContext(): EffectContext {
  const media = (query: string) => isBrowser() && window.matchMedia?.(query).matches === true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    reduced: prefersReducedMotion("auto"),
    lowPower:
      connection?.saveData === true ||
      media("(max-width: 640px)") ||
      (navigator.hardwareConcurrency ?? 8) <= 2,
    finePointer: media("(pointer: fine)"),
  };
}

/** Runs one effect on one element now; resolves with how to undo it. */
export async function mountEffect(
  element: HTMLElement,
  binding: Pick<EffectBinding, "module" | "behaviour" | "params">,
  context: EffectContext = readEffectContext(),
): Promise<EffectCleanup> {
  let behaviour: EffectBehaviour | undefined;
  if (binding.module === customModuleName) {
    behaviour = customBehaviours.get(binding.behaviour);
    if (!behaviour) {
      await new Promise<void>((resolve) => {
        const queue = waitingForCustom.get(binding.behaviour) ?? [];
        waitingForCustom.set(binding.behaviour, [...queue, resolve]);
      });
      behaviour = customBehaviours.get(binding.behaviour);
    }
  } else {
    behaviour = (await importModule(binding.module))?.behaviours[binding.behaviour];
  }
  return behaviour?.(element, binding.params, context) ?? (() => undefined);
}

function whenNearScreen(element: Element, start: () => void): () => void {
  if (typeof IntersectionObserver !== "function") {
    start();
    return () => undefined;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    },
    { rootMargin: "50% 0px" },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/** Every effect listed on the page. Returns a function that stops them all. */
export function startEffects(
  document: Document,
  effects: PageEffects,
  nodeAttribute = "data-node-id",
): () => void {
  setEffectModuleAddresses(effects.modules);
  const context = readEffectContext();
  const stops: EffectCleanup[] = [];
  const run = (
    element: HTMLElement,
    binding: Pick<EffectBinding, "module" | "behaviour" | "params">,
  ) => void mountEffect(element, binding, context).then((cleanup) => stops.push(cleanup));
  for (const binding of effects.bindings) {
    const escaped = binding.nodeId.replace(/["\\]/g, "\\$&");
    const element = document.querySelector(`[${nodeAttribute}="${escaped}"]`);
    if (element instanceof HTMLElement) {
      stops.push(whenNearScreen(element, () => run(element, binding)));
    }
  }
  const site = effects.site;
  const body = document.body;
  if (site && site.cursor.style !== "none" && context.finePointer) {
    run(body, { module: "cursor", behaviour: "siteCursor", params: { ...site.cursor } });
  }
  if (site && site.pageTransition.style !== "none") {
    run(body, {
      module: "transitions",
      behaviour: "pageTransition",
      params: { ...site.pageTransition },
    });
  }
  if (site && site.intro.style !== "none") {
    run(body, { module: "intro", behaviour: "siteIntro", params: { ...site.intro } });
  }
  return () => stops.forEach((stop) => stop());
}
