import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { readNumber, readText } from "../kit/params.js";
import { backgroundBehind } from "../kit/css-colour.js";
import { addStyleOnce, setStyles } from "../kit/styles.js";
import { luminance } from "../maths/readable.js";

/** Grain as an SVG noise tile, so it needs no WebGL and costs next to nothing. */
const grainTile = (frequency: number, slope: number, intercept: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='${slope}' intercept='${intercept}'/><feFuncG type='linear' slope='${slope}' intercept='${intercept}'/><feFuncB type='linear' slope='${slope}' intercept='${intercept}'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`,
  )}")`;

/**
 * Below this brightness an overlay blend has almost nothing to work on (on black, nothing at
 * all), so grain on dark sections is added as light specks instead.
 */
const darkBackground = 0.06;

/**
 * Film grain over the whole element, words included, as on a printed photograph. The
 * tile jumps to a new place a few times a second; with less motion asked for it stays still.
 */
const filmGrain: EffectBehaviour = (element, params, context) => {
  const strength = readNumber(params, "strength", 0.35);
  const speed = readNumber(params, "speed", 1);
  const size = readText(params, "size", "fine");
  const dark = luminance(backgroundBehind(element)) < darkBackground;
  addStyleOnce(
    "lintel-grain",
    "@keyframes lintel-grain{0%{transform:translate(0,0)}20%{transform:translate(-37px,21px)}40%{transform:translate(19px,-44px)}60%{transform:translate(-12px,33px)}80%{transform:translate(41px,9px)}100%{transform:translate(0,0)}}" +
      "@media (prefers-reduced-motion:reduce){[data-lintel-grain]{animation:none!important}}",
  );
  const restore = setStyles(element, {
    ...(getComputedStyle(element).position === "static" ? { position: "relative" } : {}),
  });
  const clip = document.createElement("div");
  clip.setAttribute("aria-hidden", "true");
  Object.assign(clip.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "2",
    borderRadius: "inherit",
    mixBlendMode: dark ? "screen" : "overlay",
    opacity: String(Math.min(1, dark ? 0.1 + strength * 0.6 : 0.12 + strength * 0.75)),
  });
  const grain = document.createElement("div");
  grain.setAttribute("data-lintel-grain", "");
  Object.assign(grain.style, {
    position: "absolute",
    inset: "-60px",
    backgroundImage: grainTile(
      size === "coarse" ? 0.45 : size === "medium" ? 0.7 : 0.95,
      // On dark sections the tile is mostly black with bright specks, so it adds only specks.
      dark ? 3 : 2.4,
      dark ? -1.25 : -0.7,
    ),
    animation:
      context.reduced || speed <= 0
        ? "none"
        : `lintel-grain ${(0.9 / Math.max(speed, 0.1)).toFixed(2)}s steps(5) infinite`,
  });
  clip.append(grain);
  element.append(clip);
  return () => {
    clip.remove();
    restore();
  };
};

export const behaviours = { filmGrain };
export default { behaviours } satisfies EffectModule;
