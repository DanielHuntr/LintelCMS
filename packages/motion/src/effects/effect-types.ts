/**
 * The shapes the effects runtime works with. Kept free of Zod so published pages never
 * download it; the checked versions live in `@lintel/motion/effects`.
 */

/** The lazily loaded files effects are split into. Each loads only on pages that use it. */
export const effectModuleNames = [
  "pointer",
  "cursor",
  "scroll",
  "depth",
  "svg",
  "physics",
  "text",
  "marquee",
  "particles",
  "liquid-gradient",
  "image-distort",
  "frosted-glass",
  "ripple",
  "transitions",
  "intro",
] as const;

export type EffectModuleName = (typeof effectModuleNames)[number];

/** Effects registered by code at runtime (see `registerEffectBehaviour`) use this module. */
export const customModuleName = "custom";

export type EffectParameterValue = number | string | boolean;
export type EffectParams = Readonly<Record<string, EffectParameterValue>>;

/** One effect on one element of a published page, as the builder's renderer lists it. */
export interface EffectBinding {
  nodeId: string;
  module: EffectModuleName | typeof customModuleName;
  /** The function inside the module that runs it: "tilt", "scramble"... */
  behaviour: string;
  params: EffectParams;
}

export interface PageTransitionSettings {
  style: "none" | "fade" | "slide" | "wipe" | "zoom";
  /** Milliseconds. */
  duration: number;
}

export interface CursorSettings {
  style: "none" | "dot" | "ring" | "ring-and-dot" | "blend";
  trail: "none" | "dots" | "line" | "comet";
  colour: string;
  /** Pixels across. */
  size: number;
}

export interface IntroSettings {
  /** "curtain" draws a line across; "logo" falls back to the name when there is no logo. */
  style: "none" | "counter" | "name" | "logo" | "curtain";
  /** What "name" shows; empty means the site's name. */
  text: string;
  background: string;
  colour: string;
}

/** Motion across the whole site: set once, in Settings → Your website and the Animate tab. */
export interface SiteEffectSettings {
  pageTransition: PageTransitionSettings;
  cursor: CursorSettings;
  intro: IntroSettings;
}

/** What a page hands the runtime: where each module lives, its effects and the site's. */
export interface PageEffects {
  modules: Partial<Record<EffectModuleName, string>>;
  bindings: readonly EffectBinding[];
  site?: SiteEffectSettings;
}

/** What every behaviour is told about the visitor's device. */
export interface EffectContext {
  /** The visitor asked for less motion: show a still or gentle version. */
  reduced: boolean;
  /** A phone, a saving-data connection or a slow device: do less work. */
  lowPower: boolean;
  /** A mouse or trackpad, rather than only touch. */
  finePointer: boolean;
}

/** Called to undo a behaviour: removes listeners, frames and anything it added. */
export type EffectCleanup = () => void;

export type EffectBehaviour = (
  element: HTMLElement,
  params: EffectParams,
  context: EffectContext,
) => EffectCleanup | void;

/** What a module file exports. */
export interface EffectModule {
  behaviours: Readonly<Record<string, EffectBehaviour>>;
}
