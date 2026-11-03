import type { SiteEffectSettings } from "../effects/effect-types.js";

/**
 * The first-visit intro: an overlay drawn over the home page the first time someone opens
 * it in a visit. The page itself is complete underneath, so search engines and screen
 * readers get the content as usual; the overlay is decoration with a "Skip intro" button.
 *
 * It only ever shows with scripts on and for people who haven't asked for less motion,
 * and CSS hides it after four seconds whatever happens, so it can't trap anyone.
 */

/** What the intro can show besides its own words: the site's name and logo. */
export interface IntroContent {
  siteName: string;
  logo: { url: string; alt: string } | null;
}

/** The shortest and longest the intro plays before it lifts away, in milliseconds. */
export const INTRO_SHORTEST_MILLISECONDS = 1300;
export const INTRO_LONGEST_MILLISECONDS = 3000;

/** How each intro leaves: the counter and name lift up, the line folds away, the logo fades. */
export const introLeavingKeyframes: Readonly<
  Record<
    Exclude<SiteEffectSettings["intro"]["style"], "none">,
    ReadonlyArray<Readonly<Record<string, string | number>>>
  >
> = {
  counter: [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
  name: [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
  curtain: [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }],
  logo: [{ opacity: 1 }, { opacity: 0 }],
};

/** The counter's number at a share (0 to 1) of the shortest time: it slows as it nears 100. */
export function introCount(share: number): number {
  const clamped = Math.min(1, Math.max(0, share));
  return Math.round((1 - (1 - clamped) ** 3) * 100);
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The words "Site name" and "Logo" (without a logo) show: what was typed, or the site's name. */
export function introWords(settings: SiteEffectSettings, content: IntroContent): string {
  return settings.intro.text.trim() || content.siteName;
}

/** The intro's markup, written at the start of `<body>`. Empty when it is off. */
export function introMarkup(
  settings: SiteEffectSettings,
  labels: { skip: string },
  content: IntroContent = { siteName: "", logo: null },
): string {
  const { style } = settings.intro;
  if (style === "none") return "";
  const words = `<span class="lintel-intro__mask"><span class="lintel-intro__name">${escapeHtml(introWords(settings, content))}</span></span>`;
  const middle =
    style === "counter"
      ? `<span class="lintel-intro__count">0</span>`
      : style === "logo" && content.logo
        ? `<img class="lintel-intro__logo" src="${escapeHtml(content.logo.url)}" alt="">`
        : style === "curtain"
          ? `<span class="lintel-intro__bar"></span>`
          : words;
  return `<div class="lintel-intro" data-style="${style}"><div class="lintel-intro__middle" aria-hidden="true">${middle}</div><button type="button" class="lintel-intro__skip">${escapeHtml(labels.skip)}</button></div>`;
}

export function introCss(settings: SiteEffectSettings): string {
  const { style, background, colour } = settings.intro;
  if (style === "none") return "";
  return `.lintel-intro { position: fixed; inset: 0; z-index: 2147483647; display: none; place-items: center; background: ${background}; color: ${colour}; font: 600 clamp(2.25rem, 9vw, 7rem)/1 var(--lintel-font-heading, system-ui), sans-serif; letter-spacing: -0.02em; }
@media (scripting: enabled) and (prefers-reduced-motion: no-preference) { .lintel-intro { display: grid; animation: lintel-intro-failsafe 0s 4s forwards; } }
.lintel-intro-seen .lintel-intro { display: none; }
@keyframes lintel-intro-failsafe { to { visibility: hidden; opacity: 0; } }
.lintel-intro__middle { padding-inline: 1.5rem; text-align: center; }
.lintel-intro__count { font-variant-numeric: tabular-nums; font-size: 1.4em; }
.lintel-intro__mask { display: inline-block; overflow: hidden; padding-block: 0.08em; }
.lintel-intro__name { display: inline-block; animation: lintel-intro-rise 900ms cubic-bezier(.22,1,.36,1) both; }
.lintel-intro__logo { display: block; max-width: min(50vw, 280px); max-height: 30vh; object-fit: contain; animation: lintel-intro-logo 1100ms cubic-bezier(.22,1,.36,1) both; }
.lintel-intro__bar { display: block; width: min(40vw, 320px); height: 2px; background: currentColor; transform-origin: 0 50%; animation: lintel-intro-bar 1.3s cubic-bezier(.65,0,.35,1) both; }
.lintel-intro__skip { position: absolute; inset-block-end: 1.5rem; inset-inline-end: 1.5rem; font: 500 0.875rem/1 system-ui, sans-serif; letter-spacing: 0; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 999px; padding: 0.6rem 1rem; cursor: pointer; opacity: 0.75; }
.lintel-intro__skip:hover { opacity: 1; }
.lintel-intro__skip:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; opacity: 1; }
@keyframes lintel-intro-rise { from { transform: translateY(105%); } }
@keyframes lintel-intro-logo { from { opacity: 0; transform: scale(0.94); filter: blur(6px); } }
@keyframes lintel-intro-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }`;
}

/** A tiny inline script for the head: hides the intro at once when it was seen this visit. */
export const introSeenScript = `try{sessionStorage.getItem("lintel-intro-seen")&&document.documentElement.classList.add("lintel-intro-seen")}catch(e){}`;
