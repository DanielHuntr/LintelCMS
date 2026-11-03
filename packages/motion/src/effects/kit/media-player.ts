import { safePictureAddress } from "./addresses.js";

/**
 * What the Lottie and Rive elements share: where their files are, when they play, and
 * swapping the still picture (the poster) for the moving one once it is ready.
 */

/**
 * The files that sit beside the effect modules (the samples, Rive's WebAssembly), by name,
 * with the fingerprinted names the build gave them. Filled in by the build; tests have none.
 */
declare const __LINTEL_EFFECT_FILES__: Readonly<Record<string, string>> | undefined;

/** The address of a file served beside the effect modules. */
export function besideModules(name: string): string {
  const files = typeof __LINTEL_EFFECT_FILES__ === "object" ? __LINTEL_EFFECT_FILES__ : {};
  return new URL(files[name] ?? name, import.meta.url).href;
}

/**
 * One of the players (src/effects/players), fetched from beside the modules by address, so
 * the modules' build never bundles or shares any of it.
 */
export function importPlayer<Player>(name: "lottie-player.js" | "rive-player.js"): Promise<Player> {
  return import(/* @vite-ignore */ besideModules(name)) as Promise<Player>;
}

/** The animation's address: its own file, or Lintel's sample when it has none yet. */
export function animationAddress(src: string, sampleName: string): string {
  const own = safePictureAddress(src);
  return own ? new URL(own, document.baseURI).href : besideModules(sampleName);
}

/** How a moving element decides when to play. */
export type PlayWhen = "load" | "view" | "hover" | "scroll";

export function readPlayWhen(value: string): PlayWhen {
  return value === "load" || value === "hover" || value === "scroll" ? value : "view";
}

/** Calls back with whether enough of the element is on screen to be worth playing. */
export function watchOnScreen(element: Element, onChange: (visible: boolean) => void) {
  if (typeof IntersectionObserver !== "function") {
    onChange(true);
    return () => undefined;
  }
  const observer = new IntersectionObserver(
    (entries) => onChange(entries.some((entry) => entry.isIntersecting)),
    { threshold: 0.2 },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/** How far the element has travelled through the window, 0 (just below) to 1 (just above). */
export function scrollProgress(element: Element): number {
  const box = element.getBoundingClientRect();
  const travel = window.innerHeight + box.height;
  return travel > 0 ? Math.min(1, Math.max(0, (window.innerHeight - box.top) / travel)) : 0;
}

/** Calls back with the scroll progress on every scroll, once per frame at most. */
export function followScroll(element: Element, onProgress: (progress: number) => void) {
  let frame = 0;
  const update = () => {
    frame = 0;
    onProgress(scrollProgress(element));
  };
  const request = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  update();
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("scroll", request);
    removeEventListener("resize", request);
  };
}

/**
 * Adds the layer the animation draws into, over the poster. The poster stays until
 * `showStage` is called, so a slow or failed load still shows the still picture.
 */
export function addStage(element: HTMLElement, tagName: "div" | "canvas") {
  const stage = document.createElement(tagName);
  stage.className = "lintel-animation__stage";
  stage.setAttribute("aria-hidden", "true");
  element.append(stage);
  const posters = [...element.querySelectorAll<HTMLElement>(".lintel-animation__poster")];
  return {
    stage,
    showStage: () => {
      element.setAttribute("data-playing", "");
      posters.forEach((poster) => (poster.hidden = true));
    },
    remove: () => {
      stage.remove();
      element.removeAttribute("data-playing");
      posters.forEach((poster) => (poster.hidden = false));
    },
  };
}

/** Whether the element has a still picture of its own to show instead of moving. */
export function hasPoster(element: HTMLElement): boolean {
  return element.querySelector("img.lintel-animation__poster") !== null;
}
