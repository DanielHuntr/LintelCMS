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
  "smooth-scroll",
  "shader-backgrounds",
  "film-grain",
  "picture-effects",
  "playground",
  "lottie",
  "rive",
  "model",
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
  /** "picture" is the site's own picture, from the media library. */
  style: "none" | "dot" | "ring" | "ring-and-dot" | "blend" | "picture";
  trail: "none" | "dots" | "line" | "comet";
  /** "text" or "brand" follow the site's theme (light and dark); otherwise a hex colour. */
  colour: string;
  /** Pixels across. */
  size: number;
  /** How the word an element gives the cursor ("View") looks. Older settings have none. */
  word?: CursorWordLook;
  /** The picture used when `style` is "picture". Older settings have none. */
  picture?: CursorPicture;
}

/**
 * The colour of the cursor's word: "auto" (the cursor's colour, or the theme's text colour
 * without a custom cursor), a theme colour by name ("brand", "text"...) or a hex colour.
 */
export type CursorWordColour = string;

export interface CursorWordLook {
  background: CursorWordColour;
  /** The letters; "auto" picks one that reads on the background. */
  colour: CursorWordColour;
  size: "small" | "medium" | "large";
  shape: "pill" | "square" | "circle";
}

export interface CursorPicture {
  /** The media library picture, or empty when none is chosen. */
  assetId: string;
  /** Its address (the original file); the page asks for a copy at the cursor's size. */
  src: string;
  /** Pixels across. */
  size: number;
  /** Where the click lands: the middle, or the top-left corner like an arrow. */
  point: "centre" | "top-left";
  /** The file's size in bytes, for the "this is large" note; 0 when unknown. */
  bytes: number;
}

export interface IntroSettings {
  /** "curtain" draws a line across; "logo" falls back to the name when there is no logo. */
  style: "none" | "counter" | "name" | "logo" | "curtain";
  /** What "name" shows; empty means the site's name. */
  text: string;
  background: string;
  colour: string;
}

export interface SmoothScrollSettings {
  /** How long the wheel's glide lasts. */
  strength: "off" | "gentle" | "strong";
}

/** Motion across the whole site: set once, in Settings → Your website and the Animate tab. */
export interface SiteEffectSettings {
  pageTransition: PageTransitionSettings;
  cursor: CursorSettings;
  intro: IntroSettings;
  smoothScroll: SmoothScrollSettings;
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
