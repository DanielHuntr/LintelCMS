import type {
  EffectBehaviour,
  EffectContext,
  EffectModule,
  EffectParameterValue,
} from "../effect-types.js";
import { backgroundBehind, resolveColour, wordColours } from "../kit/css-colour.js";
import {
  customShaderFragment,
  explainCompilerLog,
  readCustomShader,
  shaderFingerprint,
  type ShaderControl,
} from "../kit/custom-shader.js";
import { createFrameLoop } from "../kit/frames.js";
import { addBackdrop, drawingRatio, sizeCanvas } from "../kit/layers.js";
import { createDrivers, type SettingReact } from "../kit/shader-reacts.js";
import {
  shaderRenderer,
  type CompiledShader,
  type ShaderRenderer,
  type UniformValue,
} from "../kit/shader-renderer.js";
import { lookNumbers, looks, type Look } from "../kit/shader-looks.js";
import { extraLooks } from "../kit/shader-looks-extra.js";
import { stackPainter, type BlendName, type StackStep } from "../kit/shader-stack.js";
import { setStyles } from "../kit/styles.js";
import { luminance, mixRgb, scrimFor, type Rgb } from "../maths/readable.js";

/**
 * A section's background as a stack of layers (or one look with settings that react to
 * something), drawn through the page's one WebGL context. The plan arrives as JSON in the
 * `plan` setting (see `effects-catalogue/shader-plan.ts`).
 *
 * A custom shader is not trusted. Before it runs here it passes `readCustomShader`, then a
 * trial on a tiny drawing; while it runs, a frame now and then is timed, and it is drawn
 * smaller or stopped if it's too slow. One that was running when the context was lost isn't
 * tried again this visit. Whatever stops a layer, the rest carry on; with none left the
 * section keeps its plain background, under a veil if the words need one.
 */

export interface PlanLayer {
  look?: string;
  /** A saved custom shader, whose code is in the page's list of shaders... */
  shader?: string;
  /** ...or the code itself, on the builder's canvas. */
  code?: string;
  values: Record<string, EffectParameterValue>;
  blend: BlendName;
  opacity: number;
  reacts?: Record<string, SettingReact>;
}

interface Plan {
  layers: PlanLayer[];
  readable: boolean;
}

interface Running {
  plan: PlanLayer;
  program: CompiledShader;
  look?: Look;
  controls?: readonly ShaderControl[];
  whole?: ReadonlySet<string>;
  colours: readonly Rgb[];
  /** Fixed for the layer: third colour set, light-section gain. */
  fixed: Record<string, UniformValue>;
  time: number;
  custom: boolean;
}

/** Longest a trial drawing may take, in milliseconds. */
const trialLimit = 40;
/** What a frame may cost before the drawing shrinks, in milliseconds. */
const slowFrame = 120;
/** A frame is timed once in this many: waiting for the card slows the frame it times. */
const framesPerCheck = 30;
const framesPerVeilCheck = 90;
const strikesKey = "lintel-shader-strikes";
/** Film grain's Size setting, as how many pixels make a grain. */
const grainSizes: Record<string, number> = { fine: 1, medium: 2, coarse: 3 };
/** These lay over the section and have no still version, so its own picture stays under them. */
const laidOver = new Set(["dust", "contours", "grain"]);
/** Where a layer's own opacity saves what drives it (`layerOpacityReact` in the catalogue). */
const layerOpacity = "layerOpacity";

function struck(fingerprint: string): boolean {
  try {
    return (sessionStorage.getItem(strikesKey) ?? "").split(" ").includes(fingerprint);
  } catch {
    return false;
  }
}

function strike(fingerprint: string) {
  try {
    const list = (sessionStorage.getItem(strikesKey) ?? "").split(" ").filter(Boolean);
    sessionStorage.setItem(strikesKey, [...list, fingerprint].slice(-20).join(" "));
  } catch {
    // Without storage it is simply stopped for this page.
  }
}

/** The shaders the server listed with the page's effects, by id. */
function pageShaders(): Record<string, string> {
  try {
    const list = document.getElementById("lintel-effects")?.textContent;
    const shaders = list ? (JSON.parse(list) as { shaders?: unknown }).shaders : undefined;
    return typeof shaders === "object" && shaders ? (shaders as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function readPlan(params: Readonly<Record<string, EffectParameterValue>>): Plan | undefined {
  try {
    const plan = JSON.parse(String(params.plan ?? "")) as Plan;
    return Array.isArray(plan.layers) ? plan : undefined;
  } catch {
    return undefined;
  }
}

function colourOf(element: HTMLElement, value: string, fallback: string): Rgb {
  const css = value === "currentColor" ? getComputedStyle(element).color : value;
  return resolveColour(
    element,
    css,
    fallback === "currentColor" ? "#808080" : fallback || "#808080",
  );
}

function prepareLook(
  element: HTMLElement,
  renderer: ShaderRenderer,
  plan: PlanLayer,
): Running | undefined {
  const look = looks[plan.look ?? ""] ?? extraLooks[plan.look ?? ""];
  const program = look && renderer.program(look.shader);
  if (!look || !program) return undefined;
  const colours = look.colours.map((name, index) => {
    const value = plan.values[name];
    const fallback = look.defaults[index] ?? "";
    return colourOf(element, typeof value === "string" && value ? value : fallback, fallback);
  });
  const third = plan.values[look.colours[2] ?? ""];
  return {
    plan,
    program,
    look,
    colours,
    fixed: {
      hc: typeof third === "string" && third ? 1 : 0,
      gn: plan.look === "dust" && luminance(backgroundBehind(element)) > 0.5 ? 2.4 : 1,
      ...(plan.look === "grain" ? { sc: grainSizes[String(plan.values.size)] ?? 1 } : {}),
    },
    time: Math.random() * 100,
    custom: false,
  };
}

/** A custom shader, checked, compiled and tried on a tiny drawing. */
function prepareCustom(
  renderer: ShaderRenderer,
  plan: PlanLayer,
  shaders: Readonly<Record<string, string>>,
): Running | undefined {
  const source = plan.code ?? shaders[plan.shader ?? ""];
  if (!source || struck(shaderFingerprint(source))) return undefined;
  const read = readCustomShader(source);
  if (read.problems.length > 0) {
    console.warn(`Lintel: a custom shader was left out. ${read.problems[0]!.message}`);
    return undefined;
  }
  const fragment = customShaderFragment(read.code);
  const program = renderer.compile(fragment);
  if (!program) {
    const said = explainCompilerLog(renderer.problem(fragment) ?? "")[0]?.message;
    console.warn(`Lintel: a custom shader was left out. ${said ?? ""}`);
    return undefined;
  }
  return {
    plan,
    program,
    controls: read.controls,
    whole: new Set(
      read.controls.flatMap((control) =>
        control.kind === "toggle" || (control.kind === "slider" && control.whole)
          ? [control.name]
          : [],
      ),
    ),
    colours: [],
    fixed: {},
    time: Math.random() * 10,
    custom: true,
  };
}

const reactedValue = (
  values: Record<string, EffectParameterValue>,
  reacts: Record<string, SettingReact> | undefined,
  read: (react: SettingReact) => number,
): Record<string, EffectParameterValue> => {
  if (!reacts) return values;
  const moved = { ...values };
  for (const [name, react] of Object.entries(reacts)) {
    const from = values[name];
    if (typeof from === "number") moved[name] = from + (react.to - from) * read(react);
  }
  return moved;
};

function customUniforms(
  element: HTMLElement,
  controls: readonly ShaderControl[],
  values: Record<string, EffectParameterValue>,
): Record<string, UniformValue> {
  return Object.fromEntries(
    controls.map((control) => {
      const value = values[control.name];
      if (control.kind === "colour") {
        const css = typeof value === "string" ? value : control.value;
        return [control.name, colourOf(element, css, control.value)];
      }
      if (control.kind === "toggle") {
        return [control.name, (typeof value === "boolean" ? value : control.value) ? 1 : 0];
      }
      const number = typeof value === "number" ? value : control.value;
      return [control.name, Math.min(control.max, Math.max(control.min, number))];
    }),
  );
}

/** Colours across a drawing, for the veil. Empty when it can't be read. */
function sampleDrawing(canvas: HTMLCanvasElement, behind: Rgb): Rgb[] {
  const small = document.createElement("canvas");
  small.width = 12;
  small.height = 8;
  const drawing = small.getContext("2d", { willReadFrequently: true });
  if (!drawing || canvas.width === 0) return [];
  try {
    drawing.drawImage(canvas, 0, 0, 12, 8);
    const { data } = drawing.getImageData(0, 0, 12, 8);
    const shades: Rgb[] = [];
    for (let at = 0; at < data.length; at += 4) {
      const colour: Rgb = [data[at]! / 255, data[at + 1]! / 255, data[at + 2]! / 255];
      // Colours in a 2D canvas are not premultiplied when read back.
      shades.push(mixRgb(behind, colour, data[at + 3]! / 255));
    }
    return shades;
  } catch {
    return [];
  }
}

/**
 * The plain colour to start from, unless a picture sits behind the section. `ownPicture` says
 * a background picture on the section is the designer's, not the effect's still version.
 */
function seedColour(element: HTMLElement, ownPicture: boolean): Rgb | null {
  if (ownPicture && getComputedStyle(element).backgroundImage !== "none") return null;
  for (let at = element.parentElement; at; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (style.backgroundImage !== "none") return null;
    if (!/^(transparent|rgba\(.*,\s*0\))$/.test(style.backgroundColor)) break;
  }
  return backgroundBehind(element);
}

const shaderStack: EffectBehaviour = (element, params, context: EffectContext) => {
  const plan = readPlan(params);
  if (!plan || plan.layers.length === 0) return;
  const backdrop = addBackdrop(element);
  const cleanups: Array<() => void> = [backdrop.remove];
  const stop = () => () =>
    cleanups
      .splice(0)
      .reverse()
      .forEach((cleanup) => cleanup());

  let veil = 0;
  const setVeil = (shades: readonly Rgb[]) => {
    const scrim = scrimFor(shades, wordColours(element));
    if (scrim.amount === veil) return;
    veil = scrim.amount;
    const [red, green, blue] = scrim.colour.map((value) => Math.round(value * 255));
    Object.assign(backdrop.scrim.style, {
      display: scrim.amount > 0 ? "block" : "none",
      background: `rgb(${red} ${green} ${blue} / ${scrim.amount})`,
    });
  };

  let restoreBackground: (() => void) | undefined;
  cleanups.push(() => restoreBackground?.());
  /** The drawing steps aside: the plain background shows, and the words stay readable on it. */
  const fallBack = () => {
    backdrop.canvas.style.visibility = "hidden";
    restoreBackground?.();
    restoreBackground = undefined;
    veil = -1;
    setVeil([backgroundBehind(element)]);
  };

  const renderer = shaderRenderer();
  if (!renderer) {
    fallBack();
    return stop();
  }
  const painter = stackPainter(renderer);
  const shaders = pageShaders();
  const prepare = (layer: PlanLayer) =>
    layer.look ? prepareLook(element, renderer, layer) : prepareCustom(renderer, layer, shaders);
  let layers: Running[] = [];
  const prepareAll = () => {
    layers = plan.layers.flatMap((layer) => {
      const running = prepare(layer);
      return running ? [running] : [];
    });
  };
  prepareAll();

  let ratio = drawingRatio(context, {
    resolution: Math.max(...layers.map((layer) => layer.look?.resolution ?? 0.75), 0.4),
    software: renderer.software,
  });
  const drivers = createDrivers(element, context);
  cleanups.push(() => drivers.destroy());

  const valuesNow = (layer: Running) =>
    reactedValue(layer.plan.values, layer.plan.reacts, (react) => drivers.read(react));
  const opacityNow = ({ plan: { opacity, reacts } }: Running) => {
    const react = reacts?.[layerOpacity];
    return react ? opacity + (react.to - opacity) * drivers.read(react) : opacity;
  };

  const steps = (): StackStep[] =>
    layers.map((layer, index) => {
      const values = valuesNow(layer);
      const size = [backdrop.canvas.width, backdrop.canvas.height];
      if (layer.custom) {
        return {
          program: layer.program,
          uniforms: {
            time: layer.time,
            scroll: drivers.scroll,
            resolution: size,
            pointer: drivers.pointer,
            ...customUniforms(element, layer.controls ?? [], values),
          },
          whole: layer.whole,
          belowName: "lintelBelow",
          belowSizeName: "lintelBelowSize",
          blend: layer.plan.blend,
          opacity: opacityNow(layer),
        };
      }
      const [one, two, three] = layer.colours;
      return {
        program: layer.program,
        uniforms: {
          ...lookNumbers(layer.look!, values),
          ...layer.fixed,
          t: layer.time,
          d: ratio,
          e: drivers.near,
          r: size,
          m: drivers.pointer,
          a: one ?? [0, 0, 0],
          b: two ?? one ?? [0, 0, 0],
          c: three ?? one ?? [0, 0, 0],
          lo: index === 0 ? 1 : 0,
        },
        belowName: "lb",
        belowSizeName: "ls",
        blend: layer.plan.blend,
        opacity: opacityNow(layer),
      };
    });

  // With only layers that lay over the section, a picture on it is the designer's own.
  const ownPicture = plan.layers.every((layer) => laidOver.has(layer.look ?? ""));
  const seed = seedColour(element, ownPicture);
  const draw = () => {
    if (layers.length === 0) return false;
    sizeCanvas(backdrop.canvas, element.clientWidth, element.clientHeight, ratio);
    const drew = painter.paint(backdrop.canvas, seed, steps());
    if (drew) {
      backdrop.canvas.style.visibility = "";
      // Once the drawing shows, the static fallback under it steps aside.
      if (!ownPicture) restoreBackground ??= setStyles(element, { "background-image": "none" });
    }
    return drew;
  };

  /** The veil only ever deepens as a drawing moves, so it never flickers. */
  const checkVeil = () => {
    if (!plan.readable) return;
    const shades = sampleDrawing(backdrop.canvas, backgroundBehind(element));
    if (shades.length === 0) return;
    const needed = scrimFor(shades, wordColours(element));
    if (needed.amount > veil) setVeil(shades);
  };

  /** Tries each custom shader on a tiny drawing, largest cost first, before the real one. */
  const tryCustomShaders = () => {
    const custom = layers.filter((layer) => layer.custom);
    if (custom.length === 0) return;
    const trial = document.createElement("canvas");
    const all = layers;
    const fits = (layer: Running) => {
      layers = [layer];
      for (const size of [8, 48]) {
        trial.width = trial.height = size;
        painter.paint(trial, null, steps());
        painter.finish();
        painter.paint(trial, null, steps());
        const took = painter.finish();
        if (took > trialLimit) return false;
      }
      return true;
    };
    const slow = new Set(custom.filter((layer) => !fits(layer)));
    layers = all.filter((layer) => !slow.has(layer));
    slow.forEach((layer) => {
      console.warn("Lintel: a custom shader was left out, as it's too slow for this device.");
      strike(shaderFingerprint(layer.plan.code ?? shaders[layer.plan.shader ?? ""] ?? ""));
    });
  };

  const start = () => {
    tryCustomShaders();
    if (!draw()) return fallBack();
    backdrop.canvas.style.visibility = "";
    checkVeil();
  };
  start();

  let lastCustomDraw = 0;
  cleanups.push(
    renderer.watchContext((lost) => {
      if (lost) {
        // A shader that was running when the context went may be why: it isn't tried again.
        if (performance.now() - lastCustomDraw < 3000) {
          for (const layer of layers.filter((running) => running.custom)) {
            strike(shaderFingerprint(layer.plan.code ?? shaders[layer.plan.shader ?? ""] ?? ""));
          }
        }
        fallBack();
      } else {
        prepareAll();
        if (context.reduced) start();
        else if (layers.length === 0) fallBack();
      }
    }),
  );

  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => draw()) : null;
  resize?.observe(element);
  cleanups.push(() => resize?.disconnect());
  if (context.reduced) return stop();

  let frames = 0;
  let slowFrames = 0;
  const slow = context.lowPower || renderer.software;
  const loop = createFrameLoop(element, (elapsed) => {
    drivers.tick(elapsed);
    for (const layer of layers) {
      const { speed } = valuesNow(layer);
      layer.time += (elapsed / 1000) * (typeof speed === "number" ? speed : 1);
    }
    frames += 1;
    // Slow drawings lose nothing at 30 frames a second where every frame is costly.
    if (slow && frames % 2 === 1) return true;
    const hasCustom = layers.some((layer) => layer.custom);
    const timing = hasCustom && frames % framesPerCheck === 0;
    const started = timing ? performance.now() : 0;
    if (draw() && hasCustom) lastCustomDraw = performance.now();
    if (timing) {
      painter.finish();
      if (performance.now() - started > slowFrame) {
        slowFrames += 1;
        ratio *= 0.7;
        if (slowFrames >= 4) {
          layers = layers.filter((layer) => !layer.custom);
          if (layers.length === 0) fallBack();
        }
      }
    }
    if (frames % framesPerVeilCheck === 0) checkVeil();
    return true;
  });
  cleanups.push(() => loop.destroy());
  return stop();
};

export const behaviours = { shaderStack };
export default { behaviours } satisfies EffectModule;
