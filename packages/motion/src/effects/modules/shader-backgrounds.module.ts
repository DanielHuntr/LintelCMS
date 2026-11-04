import type { EffectBehaviour, EffectModule, EffectParams } from "../effect-types.js";
import { backgroundBehind, resolveColour, wordColours } from "../kit/css-colour.js";
import { createFrameLoop } from "../kit/frames.js";
import { addBackdrop, drawingRatio, sizeCanvas } from "../kit/layers.js";
import { listen } from "../kit/listen.js";
import { readNumber, readSwitch, readText } from "../kit/params.js";
import { lookNumbers, looks, type Look } from "../kit/shader-looks.js";
import { pointerWithin } from "../kit/pointer.js";
import { shaderRenderer, type UniformValue } from "../kit/shader-renderer.js";
import { setStyles } from "../kit/styles.js";
import { luminance, mixRgb, scrimFor, type Rgb } from "../maths/readable.js";
import { approach } from "../maths/smoothing.js";

/**
 * Quiet moving backgrounds for sections, each one small shader drawn through the page's
 * shared WebGL context: a soft gradient mesh, light on water, floating dust and contour
 * lines (film grain, which needs no WebGL, is the film-grain module). Every look has a static fallback in the page's
 * stylesheet (or simply the section's own background), shown before this loads, without
 * WebGL, and as a still frame for people who ask for less motion.
 *
 * Words stay readable: with "Keep words readable" on, a veil just strong enough for the
 * words' contrast is laid between the drawing and the content (see `maths/readable`).
 */

/** The look's colours, as the shader and the contrast check need them. */
function lookColours(element: HTMLElement, look: Look, params: EffectParams): [Rgb, Rgb, Rgb] {
  const read = (index: number) => {
    const fallback = look.defaults[index] ?? look.defaults[0]!;
    const value = readText(params, look.colours[index] ?? look.colours[0]!, fallback);
    if (!value) return read(0);
    return value === "currentColor"
      ? resolveColour(element, getComputedStyle(element).color, "#808080")
      : resolveColour(element, value, fallback === "currentColor" ? "#808080" : fallback);
  };
  return [read(0), read(1), read(2)];
}

/**
 * The colours words end up on: for a look that covers the section, its own colours; for one
 * laid over the section's background, that background with the look at full strength.
 */
function shadesUnder(element: HTMLElement, look: Look, colours: readonly Rgb[], strength: number) {
  if (look.covers) return [colours[0]!, mixRgb(colours[0]!, colours[1]!, 0.3 + 0.6 * strength)];
  const behind = backgroundBehind(element);
  return [behind, ...colours.map((colour) => mixRgb(behind, colour, 0.35 + 0.65 * strength))];
}

const shaderBackground: EffectBehaviour = (element, params, context) => {
  const look = looks[readText(params, "look", "mesh")] ?? looks.mesh!;
  const strength = readNumber(params, "strength", 0.5);
  const speed = readNumber(params, "speed", 1);
  const colours = lookColours(element, look, params);
  const backdrop = addBackdrop(element);
  const cleanups: Array<() => void> = [backdrop.remove];
  const stop = () => () =>
    cleanups
      .splice(0)
      .reverse()
      .forEach((cleanup) => cleanup());

  if (readSwitch(params, "readable", false)) {
    const scrim = scrimFor(shadesUnder(element, look, colours, strength), wordColours(element));
    if (scrim.amount > 0) {
      const [red, green, blue] = scrim.colour.map((value) => Math.round(value * 255));
      Object.assign(backdrop.scrim.style, {
        display: "block",
        background: `rgb(${red} ${green} ${blue} / ${scrim.amount})`,
      });
    }
  }

  const renderer = shaderRenderer();
  if (!renderer || !renderer.supports(look.shader)) {
    backdrop.canvas.style.display = "none";
    return stop();
  }
  const ratio = drawingRatio(context, { resolution: look.resolution, software: renderer.software });
  const pointer = { x: 0.5, y: 0.5, near: 0 };
  const eased = { x: 0.5, y: 0.5, near: 0 };
  let time = Math.random() * 100;
  let restoreBackground: (() => void) | undefined;
  cleanups.push(() => restoreBackground?.());
  const numbers = lookNumbers(look, params);
  // A dark speck on a pale ground needs more presence than the same speck in light.
  const gain = look === looks.dust && luminance(backgroundBehind(element)) > 0.5 ? 2.4 : 1;
  const thirdColour = readText(params, look.colours[2] ?? "", "") ? 1 : 0;
  const uniforms = (): Record<string, UniformValue> => ({
    ...numbers,
    t: time,
    gn: gain,
    hc: thirdColour,
    lo: 0,
    d: ratio,
    e: eased.near,
    r: [backdrop.canvas.width, backdrop.canvas.height],
    m: [eased.x, eased.y],
    a: colours[0],
    b: colours[1],
    c: colours[2],
  });
  const draw = () => {
    sizeCanvas(backdrop.canvas, element.clientWidth, element.clientHeight, ratio);
    const drew = renderer.paint(backdrop.canvas, look.shader, uniforms());
    backdrop.canvas.style.visibility = drew ? "" : "hidden";
    // Once the drawing shows, the static fallback under it steps aside; if it stops (the
    // context is lost), the fallback comes back.
    if (drew && !restoreBackground) {
      restoreBackground = setStyles(element, { "background-image": "none" });
    } else if (!drew) {
      restoreBackground?.();
      restoreBackground = undefined;
    }
  };
  draw();
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => draw()) : null;
  resize?.observe(element);
  cleanups.push(() => resize?.disconnect());
  if (context.reduced) return stop();

  let frames = 0;
  const slow = context.lowPower || renderer.software;
  const loop = createFrameLoop(element, (elapsed) => {
    time += (elapsed / 1000) * speed;
    eased.x = approach(eased.x, pointer.x, 0.96, elapsed);
    eased.y = approach(eased.y, pointer.y, 0.96, elapsed);
    eased.near = approach(eased.near, pointer.near, 0.94, elapsed);
    // Slow drawings lose nothing at 30 frames a second where every frame is costly.
    frames += 1;
    if (!slow || frames % 2 === 0) draw();
    return true;
  });
  cleanups.push(() => loop.destroy());
  if (look.pointer && context.finePointer) {
    cleanups.push(
      listen(element, {
        pointermove: (event: PointerEvent) => {
          const at = pointerWithin(element, event);
          pointer.x = at.x / 2 + 0.5;
          pointer.y = 0.5 - at.y / 2;
          pointer.near = 1;
        },
        pointerleave: () => {
          pointer.near = 0;
        },
      }),
    );
  }
  return stop();
};

export const behaviours = { shaderBackground };
export default { behaviours } satisfies EffectModule;
