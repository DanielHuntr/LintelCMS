import type { PageTransitionSettings, SiteEffectSettings } from "../effects/effect-types.js";

/**
 * The looks a site can pick for moving from one page to the next. Each is a pair of
 * keyframe lists: how the page being left goes, and how the new page arrives. The same
 * lists drive the published site (written out as CSS for the browser's cross-document view
 * transitions) and the preview in Settings → Your website, so what people see in the
 * preview is what visitors get.
 */

export type PageTransitionLook = Exclude<PageTransitionSettings["style"], "none">;

/** One keyframe: CSS properties in camel case, as the Web Animations API takes them. */
export type LookKeyframe = Readonly<Record<string, string | number>>;

interface LookFrames {
  leave: readonly LookKeyframe[];
  enter: readonly LookKeyframe[];
  easing: string;
  /**
   * Fade blends the two pages into each other (the browser's own cross-fade). The others
   * lay the new page over the old one, which needs ordinary blending.
   */
  layered: boolean;
}

export const pageTransitionLooks: Readonly<Record<PageTransitionLook, LookFrames>> = {
  fade: {
    leave: [{ opacity: 1 }, { opacity: 0 }],
    enter: [{ opacity: 0 }, { opacity: 1 }],
    easing: "cubic-bezier(.4,0,.2,1)",
    layered: false,
  },
  slide: {
    leave: [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(-4%)" },
    ],
    enter: [
      { opacity: 0, transform: "translateY(6%)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    easing: "cubic-bezier(.22,1,.36,1)",
    layered: true,
  },
  wipe: {
    leave: [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0.35, transform: "scale(.97)" },
    ],
    enter: [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    easing: "cubic-bezier(.76,0,.24,1)",
    layered: true,
  },
  zoom: {
    leave: [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(.94)" },
    ],
    enter: [
      { opacity: 0, transform: "scale(1.05)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    easing: "cubic-bezier(.65,0,.35,1)",
    layered: true,
  },
};

/** The three speeds offered, in milliseconds. Any length from 100 to 1500 still works. */
export const pageTransitionSpeeds = { quick: 300, steady: 500, slow: 800 } as const;
export type PageTransitionSpeed = keyof typeof pageTransitionSpeeds;

/** The named speed closest to a length, for showing a saved length as a choice. */
export function nearestPageTransitionSpeed(duration: number): PageTransitionSpeed {
  const speeds = Object.entries(pageTransitionSpeeds) as Array<[PageTransitionSpeed, number]>;
  return speeds.reduce((best, current) =>
    Math.abs(current[1] - duration) < Math.abs(best[1] - duration) ? current : best,
  )[0];
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Keyframes as a CSS @keyframes body: `0% { opacity: 1 } 100% { opacity: 0 }`. */
export function keyframesCss(frames: readonly LookKeyframe[]): string {
  return frames
    .map((frame, index) => {
      const offset = Math.round((index / Math.max(1, frames.length - 1)) * 100);
      const declarations = Object.entries(frame)
        .map(([name, value]) => `${kebab(name)}: ${String(value)}`)
        .join("; ");
      return `${offset}% { ${declarations} }`;
    })
    .join(" ");
}

/**
 * The page transition as CSS: cross-document view transitions run it with no script, in
 * browsers that have them. Others simply change page. Only for people who haven't asked
 * for less motion. Elements carried across pages (the "Carry across pages" effect) glide
 * at the same speed.
 */
export function pageTransitionCss(settings: SiteEffectSettings): string {
  const { style, duration } = settings.pageTransition;
  if (style === "none") return "";
  const look = pageTransitionLooks[style];
  const blending = look.layered ? " mix-blend-mode: normal;" : "";
  const timing = `${duration}ms ${look.easing} both`;
  return `@media (prefers-reduced-motion: no-preference) {
@view-transition { navigation: auto; }
::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation-duration: ${duration}ms; animation-timing-function: ${look.easing}; }
::view-transition-old(root) { animation: ${timing} lintel-page-leave;${blending} }
::view-transition-new(root) { animation: ${timing} lintel-page-enter;${blending} }
}
@keyframes lintel-page-leave { ${keyframesCss(look.leave)} }
@keyframes lintel-page-enter { ${keyframesCss(look.enter)} }`;
}

/**
 * A tiny head script for sites with page transitions. A name for carrying an element across
 * pages must be unique on a page, or the browser skips the whole transition; a list of
 * projects where every picture is carried breaks that. So as a page is left, only the
 * carried element beside the link that was followed keeps its name, and as a page arrives,
 * only the first of each name does.
 */
export const carriedElementsScript = `(function(){var cleared=[];function keep(url){cleared.forEach(function(e){e.style.viewTransitionName=""});cleared=[];var groups={};document.querySelectorAll("[data-node-id]").forEach(function(e){var n=getComputedStyle(e).viewTransitionName;if(n&&n.indexOf("lintel-")===0)(groups[n]=groups[n]||[]).push(e)});Object.keys(groups).forEach(function(n){var list=groups[n];if(list.length<2)return;var chosen=url?null:list[0];if(url)list.some(function(e){for(var a=e,i=0;a&&i<6;a=a.parentElement,i++){var links=a.matches("a[href]")?[a]:a.querySelectorAll("a[href]");if(links.length){for(var j=0;j<links.length;j++)if(links[j].href===url)return chosen=e;return false}}return false});list.forEach(function(e){if(e!==chosen){e.style.viewTransitionName="none";cleared.push(e)}})})}addEventListener("pageswap",function(event){var a=event.activation;keep(a&&a.entry?a.entry.url:"x")});addEventListener("pagereveal",function(){keep("")})})();`;
