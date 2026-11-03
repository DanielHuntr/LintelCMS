import { z } from "zod";
import type { SiteEffectSettings } from "../effects/effect-types.js";

/**
 * Motion across the whole site, set once in the builder's site settings: the page
 * transition, the cursor, the intro and smooth scrolling. Everything starts off ("none"), so a new site
 * ships no effect code at all. The CSS and markup here are written into every page by
 * the server; the runtime only adds what CSS can't do.
 */

const hexColour = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, { error: "Colours should be written like #7539fd" });

/** The theme's text or brand colour (so it follows light and dark), or one picked by hand. */
const cursorColour = z.union([z.enum(["text", "brand"]), hexColour]);

export const siteEffectSettingsSchema = z.object({
  pageTransition: z
    .object({
      style: z.enum(["none", "fade", "slide", "wipe", "zoom"]).default("none"),
      duration: z.number().min(100).max(1500).default(450),
    })
    .default({ style: "none", duration: 450 }),
  cursor: z
    .object({
      style: z.enum(["none", "dot", "ring", "ring-and-dot", "blend"]).default("none"),
      trail: z.enum(["none", "dots", "line", "comet"]).default("none"),
      colour: cursorColour.default("text"),
      size: z.number().min(8).max(96).default(32),
    })
    .default({ style: "none", trail: "none", colour: "text", size: 32 }),
  intro: z
    .object({
      style: z.enum(["none", "curtain", "counter", "name"]).default("none"),
      text: z.string().trim().max(60).default(""),
      background: hexColour.default("#111111"),
      colour: hexColour.default("#ffffff"),
    })
    .default({ style: "none", text: "", background: "#111111", colour: "#ffffff" }),
  smoothScroll: z
    .object({ strength: z.enum(["off", "gentle", "strong"]).default("off") })
    .default({ strength: "off" }),
}) satisfies z.ZodType<SiteEffectSettings>;

export const defaultSiteEffectSettings: SiteEffectSettings = siteEffectSettingsSchema.parse({});

/** Whether any site-wide effect is switched on, so pages need the runtime. */
export function hasSiteEffects(settings: SiteEffectSettings): boolean {
  return (
    settings.pageTransition.style !== "none" ||
    settings.cursor.style !== "none" ||
    settings.intro.style !== "none" ||
    settings.smoothScroll.strength !== "off"
  );
}

const transitionFrames: Record<
  Exclude<SiteEffectSettings["pageTransition"]["style"], "none">,
  [string, string]
> = {
  fade: ["from { opacity: 1 } to { opacity: 0 }", "from { opacity: 0 } to { opacity: 1 }"],
  slide: [
    "to { opacity: 0; transform: translateY(-32px) }",
    "from { opacity: 0; transform: translateY(32px) }",
  ],
  wipe: [
    "to { opacity: 0.6 }",
    "from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) }",
  ],
  zoom: [
    "to { opacity: 0; transform: scale(0.96) }",
    "from { opacity: 0; transform: scale(1.04) }",
  ],
};

/**
 * The page transition as CSS: cross-document view transitions run it with no script.
 * Only for people who haven't asked for less motion.
 */
export function pageTransitionCss(settings: SiteEffectSettings): string {
  const { style, duration } = settings.pageTransition;
  if (style === "none") return "";
  const [leave, enter] = transitionFrames[style];
  return `@media (prefers-reduced-motion: no-preference) {
@view-transition { navigation: auto; }
::view-transition-old(root) { animation: ${duration}ms cubic-bezier(.65,0,.35,1) both lintel-page-leave; }
::view-transition-new(root) { animation: ${duration}ms cubic-bezier(.65,0,.35,1) both lintel-page-enter; }
}
@keyframes lintel-page-leave { ${leave} }
@keyframes lintel-page-enter { ${enter} }`;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The intro's markup, written at the start of `<body>`. Without scripts it never shows, and
 * after four seconds it hides itself whatever happens (see introCss), so it can't trap anyone.
 */
export function introMarkup(
  settings: SiteEffectSettings,
  labels: { skip: string; loading: string },
): string {
  const { style, text } = settings.intro;
  if (style === "none") return "";
  const middle =
    style === "counter"
      ? `<span class="lintel-intro__count">0</span><span class="lintel-intro__percent">%</span>`
      : style === "name"
        ? `<span class="lintel-intro__name">${escapeHtml(text)}</span>`
        : `<span class="lintel-intro__bar"></span>`;
  return `<div class="lintel-intro" data-style="${style}" role="status" aria-label="${escapeHtml(labels.loading)}"><div class="lintel-intro__middle" aria-hidden="true">${middle}</div><button type="button" class="lintel-intro__skip">${escapeHtml(labels.skip)}</button></div>`;
}

export function introCss(settings: SiteEffectSettings): string {
  const { style, background, colour } = settings.intro;
  if (style === "none") return "";
  return `.lintel-intro { position: fixed; inset: 0; z-index: 2147483647; display: none; place-items: center; background: ${background}; color: ${colour}; font: 600 clamp(2rem, 8vw, 6rem)/1 system-ui, sans-serif; }
@media (scripting: enabled) { .lintel-intro { display: grid; animation: lintel-intro-failsafe 0s 4s forwards; } }
.lintel-intro-seen .lintel-intro { display: none; }
@keyframes lintel-intro-failsafe { to { visibility: hidden; opacity: 0; } }
.lintel-intro__bar { display: block; width: min(40vw, 320px); height: 2px; background: currentColor; transform-origin: 0 50%; animation: lintel-intro-bar 1.3s cubic-bezier(.65,0,.35,1) both; }
.lintel-intro__name { animation: lintel-intro-name 900ms cubic-bezier(.2,.8,.2,1) both; }
.lintel-intro__percent { font-size: 0.4em; vertical-align: super; }
.lintel-intro__skip { position: absolute; inset-block-end: 1.5rem; inset-inline-end: 1.5rem; font: 500 0.875rem/1 system-ui, sans-serif; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 999px; padding: 0.6rem 1rem; cursor: pointer; opacity: 0.8; }
.lintel-intro__skip:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
@keyframes lintel-intro-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes lintel-intro-name { from { opacity: 0; transform: translateY(0.3em); } }
@media (prefers-reduced-motion: reduce) { .lintel-intro__bar, .lintel-intro__name { animation: none; } }`;
}

/** A tiny inline script for the head: hides the intro at once on later pages of the visit. */
export const introSeenScript = `try{sessionStorage.getItem("lintel-intro-seen")&&document.documentElement.classList.add("lintel-intro-seen")}catch(e){}`;
