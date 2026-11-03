import type { MotionDemo } from "./quickPicks.js";

/**
 * The tiles' tiny looping drawings, as plain CSS animations: no script runs for them, and
 * each one rests and repeats calmly. Shapes rest where they end up, so with reduced motion
 * (where every animation here is switched off) the tile shows a still shape.
 *
 * Markup: `[data-motion-demo="<demo>"]` holds `.motion-demo-shape` and, for some demos,
 * `.motion-demo-extra` (a second layer, a dot, a line). `MotionTile` draws it.
 */

const cycle = "2.6s";

/** Per demo: the keyframes for the shape, and for the extra layer where there is one. */
const demos: Record<
  MotionDemo,
  { shape: string; extra?: string; timing?: string; duration?: string; alternate?: boolean }
> = {
  rise: {
    shape:
      "0%,8%{opacity:0;transform:translateY(9px)}40%,86%{opacity:1;transform:none}100%{opacity:0}",
  },
  fade: { shape: "0%,8%{opacity:0}42%,86%{opacity:1}100%{opacity:0}" },
  words: {
    shape:
      "0%,8%{opacity:0;transform:translateY(6px)}36%,86%{opacity:1;transform:none}100%{opacity:0}",
  },
  slide: {
    shape:
      "0%,8%{opacity:0;transform:translateX(-14px)}40%,86%{opacity:1;transform:none}100%{opacity:0}",
  },
  pop: {
    shape:
      "0%,8%{opacity:0;transform:scale(.4)}30%{opacity:1;transform:scale(1.12)}42%,86%{opacity:1;transform:none}100%{opacity:0}",
  },
  blur: {
    shape: "0%,8%{opacity:0;filter:blur(5px)}44%,86%{opacity:1;filter:none}100%{opacity:0}",
  },
  reveal: {
    shape:
      "0%,8%{clip-path:inset(100% 0 0 0)}44%,86%{clip-path:inset(0)}100%{clip-path:inset(0 0 100% 0)}",
  },
  lift: {
    shape:
      "0%,20%,90%,100%{transform:none;box-shadow:none}40%,70%{transform:translateY(-4px);box-shadow:0 5px 8px rgb(0 0 0/.18)}",
  },
  grow: { shape: "0%,20%,90%,100%{transform:none}40%,70%{transform:scale(1.18)}" },
  brighten: { shape: "0%,20%,90%,100%{opacity:.55}40%,70%{opacity:1}" },
  tilt: {
    shape:
      "0%,100%{transform:perspective(60px) rotateY(0)}30%{transform:perspective(60px) rotateY(28deg) rotateX(-8deg)}70%{transform:perspective(60px) rotateY(-28deg) rotateX(8deg)}",
  },
  magnet: {
    shape: "0%,15%,95%,100%{transform:none}45%,70%{transform:translate(6px,-3px)}",
    extra:
      "0%,15%,95%,100%{transform:translate(14px,-8px);opacity:.25}45%,70%{transform:translate(10px,-6px);opacity:.9}",
  },
  underline: {
    shape: "",
    extra:
      "0%,15%{transform:scaleX(0)}45%,80%{transform:scaleX(1)}100%{transform:scaleX(1);opacity:0}",
  },
  swing: {
    shape:
      "0%,15%,75%,100%{transform:none}28%{transform:rotate(-14deg)}42%{transform:rotate(9deg)}55%{transform:rotate(-4deg)}",
  },
  press: {
    shape: "0%,30%,70%,100%{transform:none}42%{transform:scale(.78)}55%{transform:scale(1.05)}",
  },
  throb: {
    shape: "0%,20%,60%,100%{transform:none}30%,48%{transform:scale(1.2)}39%{transform:scale(1)}",
  },
  bounce: {
    shape:
      "0%,20%,80%,100%{transform:none}35%{transform:translateY(-10px)}50%{transform:translateY(0) scaleY(.85)}60%{transform:translateY(-3px)}70%{transform:none}",
  },
  shake: {
    shape:
      "0%,20%,70%,100%{transform:none}28%{transform:translateX(-5px)}36%{transform:translateX(5px)}44%{transform:translateX(-4px)}52%{transform:translateX(3px)}60%{transform:translateX(-1px)}",
  },
  wiggle: {
    shape:
      "0%,20%,70%,100%{transform:none}30%{transform:rotate(-12deg)}40%{transform:rotate(10deg)}50%{transform:rotate(-6deg)}60%{transform:rotate(3deg)}",
  },
  flash: { shape: "0%,20%,70%,100%{opacity:1}30%,50%{opacity:.2}40%,60%{opacity:1}" },
  parallax: {
    shape: "0%,100%{transform:translateY(8px)}50%{transform:translateY(-8px)}",
    extra: "0%,100%{transform:translateY(3px)}50%{transform:translateY(-3px)}",
    timing: "ease-in-out",
  },
  drift: {
    shape: "0%,100%{transform:translateY(10px)}50%{transform:translateY(-10px)}",
    timing: "ease-in-out",
  },
  fadeThrough: {
    shape:
      "0%{opacity:0;transform:translateY(12px)}40%,60%{opacity:1}100%{opacity:0;transform:translateY(-12px)}",
    timing: "linear",
  },
  scrollGrow: {
    shape: "0%,100%{transform:scale(.55)}50%{transform:scale(1.1)}",
    timing: "ease-in-out",
  },
  turn: {
    shape: "0%,100%{transform:rotate(-45deg)}50%{transform:rotate(45deg)}",
    timing: "ease-in-out",
  },
  breathe: { shape: "0%,100%{opacity:1}50%{opacity:.4}", timing: "ease-in-out" },
  spin: { shape: "from{transform:rotate(0)}to{transform:rotate(360deg)}", timing: "linear" },
  dots: {
    shape: "0%,60%,100%{transform:none}30%{transform:translateY(-6px)}",
    timing: "ease-in-out",
  },
  fill: {
    shape: "",
    extra: "0%{transform:scaleX(0)}70%,100%{transform:scaleX(1)}",
    timing: "ease-in-out",
  },
  roll: { shape: "0%,20%,90%,100%{transform:none}40%,70%{transform:translateY(-10px)}" },
  scramble: {
    shape: "0%,20%,70%,100%{opacity:1}28%{opacity:.2}36%{opacity:.85}44%{opacity:.3}54%{opacity:1}",
    timing: "steps(1)",
  },
  wave: {
    shape: "0%,20%,60%,100%{transform:none}35%{transform:translateY(-5px)}",
    timing: "ease-in-out",
  },
  bolder: { shape: "0%,20%,90%,100%{transform:none}40%,70%{transform:scaleY(2)}" },
  mesh: {
    shape: "0%,100%{transform:translate(0,0)}50%{transform:translate(14px,6px)}",
    extra: "0%,100%{transform:translate(0,0)}50%{transform:translate(-12px,-5px)}",
    timing: "ease-in-out",
    duration: "5s",
  },
  light: {
    shape: "0%{transform:translate(0,0)}100%{transform:translate(-8px,4px)}",
    timing: "ease-in-out",
    duration: "3.2s",
    alternate: true,
  },
  dust: {
    shape:
      "0%{transform:translateY(5px);opacity:0}30%,70%{opacity:.7}100%{transform:translateY(-7px);opacity:0}",
    timing: "linear",
    duration: "3s",
  },
  contours: {
    shape: "0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.15) rotate(6deg)}",
    timing: "ease-in-out",
    duration: "5s",
  },
  grain: {
    shape:
      "0%{transform:translate(0,0)}25%{transform:translate(-5px,3px)}50%{transform:translate(4px,-4px)}75%{transform:translate(-2px,5px)}100%{transform:translate(0,0)}",
    timing: "steps(1)",
    duration: ".6s",
  },
  develop: {
    shape:
      "0%,8%{opacity:.25;filter:blur(3px)}55%,88%{opacity:1;filter:none}100%{opacity:.25;filter:blur(3px)}",
    extra: "0%,8%{opacity:1}55%,88%{opacity:0}100%{opacity:1}",
  },
  pixels: { shape: "0%,10%{opacity:.6}50%,88%{opacity:1}100%{opacity:.6}" },
  split: {
    shape:
      "0%,20%,85%,100%{box-shadow:0 0 0 transparent,0 0 0 transparent}45%,65%{box-shadow:-2px 0 0 rgb(255 40 90/.55),2px 0 0 rgb(30 150 255/.55)}",
  },
  liquid: {
    shape:
      "0%,100%{border-radius:6px}30%{border-radius:45% 30% 50% 35%/35% 50% 30% 45%}60%{border-radius:30% 50% 35% 45%/50% 35% 45% 30%}",
    timing: "ease-in-out",
  },
  lens: {
    shape: "",
    extra: "0%,100%{transform:translateX(-2px)}50%{transform:translateX(11px)}",
    timing: "ease-in-out",
  },
};

/** Textures some drawings use: woven light, contour rings and grain. */
const grainTile = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='1'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>",
)}")`;
const textures =
  `.motion-demo-light{background-image:repeating-linear-gradient(62deg,transparent 0 5px,currentColor 5px 6px),repeating-linear-gradient(-58deg,transparent 0 7px,currentColor 7px 8px);opacity:.35}` +
  `.motion-demo-contours{background-image:repeating-radial-gradient(circle at 40% 60%,transparent 0 3px,currentColor 3px 4px);opacity:.4}` +
  `.motion-demo-grain{background-image:${grainTile};opacity:.55;mix-blend-mode:multiply}` +
  `[data-motion-demo="pixels"] .motion-demo-block{animation:motion-demo-pixel 2.6s steps(1) infinite}` +
  `@keyframes motion-demo-pixel{45%,88%{opacity:1}}`;

function rule(
  demo: string,
  part: "shape" | "extra",
  frames: string,
  timing: string,
  duration = cycle,
  alternate = false,
): string {
  if (!frames) return "";
  const name = `motion-demo-${demo}-${part}`;
  const direction = alternate ? " alternate" : "";
  return (
    `@keyframes ${name}{${frames}}` +
    `[data-motion-demo="${demo}"] .motion-demo-${part}{animation:${name} ${duration} ${timing} infinite${direction}}`
  );
}

/** Every demo's CSS, written once into the panel. */
export const motionDemoCss =
  Object.entries(demos)
    .map(
      ([demo, { shape, extra, timing = "cubic-bezier(.2,.7,.2,1)", duration, alternate }]) =>
        rule(demo, "shape", shape, timing, duration, alternate) +
        (extra ? rule(demo, "extra", extra, timing, duration, alternate) : ""),
    )
    .join("") +
  textures +
  // Letters, words and dots follow one another.
  `[data-motion-demo] .motion-demo-shape:nth-child(2){animation-delay:.12s}` +
  `[data-motion-demo] .motion-demo-shape:nth-child(3){animation-delay:.24s}` +
  `@media (prefers-reduced-motion:reduce){[data-motion-demo] *{animation:none!important}}`;
