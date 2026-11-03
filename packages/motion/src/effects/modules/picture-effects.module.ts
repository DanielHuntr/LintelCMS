import type {
  EffectBehaviour,
  EffectCleanup,
  EffectContext,
  EffectModule,
} from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { addPictureLayer, drawingRatio, findPicture, type PictureLayer } from "../kit/layers.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { shaderRenderer, type ShaderTexture } from "../kit/shader-renderer.js";
import { fitOf, pictureLookup, pictureTexture, placementUniforms } from "../kit/picture-shader.js";
import { setStyles } from "../kit/styles.js";
import { loaded } from "../kit/loaded.js";
import { noiseFunctions } from "../kit/shader-source.js";
import { approach, clamp } from "../maths/smoothing.js";

/**
 * Effects for pictures: one that develops out of soft noise as it comes into view, one
 * that pixelates in, and a slight colour split while the pointer moves over it. The real
 * picture stays in the page throughout, so it is the fallback: without WebGL, with less
 * motion asked for, for a picture from another site that can't be read, and once a
 * reveal has finished (its canvas is then taken away).
 */

const developShader = `${noiseFunctions}${pictureLookup}
uniform float t,p;uniform vec2 r;
void main(){float a=1.-p;vec2 w=vec2(r.x/r.y,1.);
float pattern=n(uv*w*3.+t*.15)*.65+n(uv*w*9.-t*.2)*.35;
vec2 o=(vec2(n(uv*w*5.+t*.3),n(uv*w*5.-t*.3+5.))-.5)*a*a*.14;vec2 sp=uv+o;float b=a*.01;
vec4 col=(edge(sp)+edge(sp+vec2(b,0.))+edge(sp-vec2(b,0.))+edge(sp+vec2(0.,b)))*.25*pic(uv).a;
col.rgb+=(h(gl_FragCoord.xy+fract(t))-.5)*a*.35;
gl_FragColor=col*smoothstep(pattern-.18,pattern+.18,p*1.4-.2);}`;

const splitShader = `${pictureLookup}
uniform vec2 v;
void main(){vec4 mid=pic(uv);gl_FragColor=vec4(edge(uv+v).r,mid.g,edge(uv-v).b,1.)*mid.a;}`;

/** Calls `start` once the element is a quarter on screen (or at once, without the observer). */
function whenSeen(element: Element, start: () => void): EffectCleanup {
  if (typeof IntersectionObserver !== "function") {
    start();
    return () => undefined;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    },
    { threshold: 0.25 },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * A picture hidden behind its canvas until a reveal ends. Hiding waits for the canvas to
 * be ready, so a picture is never blank for want of a drawing.
 */
function preparePicture(element: HTMLElement, context: EffectContext) {
  const image = findPicture(element);
  if (!image || context.reduced) return undefined;
  const layer = addPictureLayer(image);
  let restoreImage: () => void = () => undefined;
  return {
    layer,
    hide: () => {
      restoreImage = setStyles(image, { opacity: "0" });
    },
    finish: () => {
      restoreImage();
      layer.remove();
    },
  };
}

/** The picture develops out of soft, drifting noise as it comes into view. */
const developReveal: EffectBehaviour = (element, params, context) => {
  const prepared = preparePicture(element, context);
  if (!prepared) return;
  const { layer, hide, finish } = prepared;
  const renderer = shaderRenderer();
  if (!renderer?.supports(developShader)) return finish();
  const duration = 1600 / clamp(readNumber(params, "speed", 1), 0.2, 3);
  const ratio = drawingRatio(context, { software: renderer.software });
  let texture: ShaderTexture | undefined;
  let progress = 0;
  let playing = false;
  let time = Math.random() * 10;
  const draw = () =>
    texture &&
    renderer.paint(
      layer.canvas,
      developShader,
      {
        t: time,
        p: 1 - Math.pow(1 - progress, 3),
        r: [layer.canvas.width, layer.canvas.height],
        ...placementUniforms(layer.image),
      },
      texture,
    );
  const loop = createFrameLoop(element, (elapsed) => {
    if (!playing) return false;
    time += elapsed / 1000;
    progress = Math.min(1, progress + elapsed / duration);
    draw();
    if (progress >= 1) end();
    return progress < 1;
  });
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    loop.destroy();
    texture?.release();
    finish();
  };
  let stopWatching: EffectCleanup = () => undefined;
  void loaded(layer.image)
    .then(async (image) => {
      if (ended) return;
      texture = await pictureTexture(renderer, image);
      if (ended) return texture?.release();
      layer.place(ratio);
      if (!texture || !draw()) return end();
      hide();
      stopWatching = whenSeen(layer.image, () => {
        playing = true;
        loop.wake();
      });
    })
    .catch(end);
  return combine(end, () => stopWatching());
};

/** The picture pixelates in: big blocks, then smaller, then sharp. No WebGL needed. */
const pixelReveal: EffectBehaviour = (element, params, context) => {
  const prepared = preparePicture(element, context);
  if (!prepared) return;
  const { layer, hide, finish } = prepared;
  const drawing = layer.canvas.getContext("2d");
  const small = document.createElement("canvas").getContext("2d");
  if (!drawing || !small) return finish();
  const startBlock = clamp(readNumber(params, "blocks", 32), 8, 96);
  const blocks = [1, 0.6, 0.36, 0.2, 0.1, 0.05].map((share) => Math.max(2, startBlock * share));
  const step = 900 / clamp(readNumber(params, "speed", 1), 0.2, 3) / blocks.length;
  let timer = 0;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    finish();
  };
  const draw = (block: number, ratio: number) => {
    const image = layer.image;
    const { source, target } = fitOf(image);
    const across = Math.max(1, Math.round(target.width / block));
    const down = Math.max(1, Math.round(target.height / block));
    small.canvas.width = across;
    small.canvas.height = down;
    small.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, across, down);
    drawing.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawing.imageSmoothingEnabled = false;
    drawing.clearRect(0, 0, image.offsetWidth, image.offsetHeight);
    drawing.drawImage(small.canvas, target.x, target.y, target.width, target.height);
  };
  let stopWatching: EffectCleanup = () => undefined;
  void loaded(layer.image)
    .then(() => {
      if (ended) return;
      const ratio = drawingRatio(context);
      layer.place(ratio);
      try {
        draw(blocks[0]!, ratio);
      } catch {
        // A picture from another site without permission: it simply shows.
        return end();
      }
      hide();
      stopWatching = whenSeen(layer.image, () => {
        let at = 0;
        const next = () => {
          at += 1;
          if (at >= blocks.length) return end();
          draw(blocks[at]!, ratio);
          timer = window.setTimeout(next, step);
        };
        timer = window.setTimeout(next, step);
      });
    })
    .catch(end);
  return combine(end, () => stopWatching());
};

/**
 * The picture's colours part very slightly while the pointer moves over it, more when it
 * moves fast, and settle back when it stops. Mouse and trackpad only.
 */
const colourSplit: EffectBehaviour = (element, params, context) => {
  const image = findPicture(element);
  if (!image || context.reduced || !context.finePointer) return;
  const renderer = shaderRenderer();
  if (!renderer?.supports(splitShader)) return;
  const layer: PictureLayer = addPictureLayer(image);
  layer.canvas.style.opacity = "0";
  const strength = readNumber(params, "strength", 0.5);
  const ratio = drawingRatio(context, { software: renderer.software });
  let texture: ShaderTexture | undefined;
  void loaded(image)
    .then(async () => (texture = await pictureTexture(renderer, image)))
    .catch(() => undefined);
  const pointer = { x: 0, y: 0, dx: 0, dy: 0 };
  const split = { x: 0, y: 0 };
  let over = false;
  const loop = createFrameLoop(element, (elapsed) => {
    // Points away from the middle a touch, plus how fast the pointer is going.
    const reach = 0.012 * strength;
    const targetX = over ? clamp(pointer.x * 0.25 + pointer.dx * 6, -1, 1) * reach : 0;
    const targetY = over ? clamp(-pointer.y * 0.25 - pointer.dy * 6, -1, 1) * reach : 0;
    pointer.dx *= 0.85;
    pointer.dy *= 0.85;
    split.x = approach(split.x, targetX, 0.85, elapsed);
    split.y = approach(split.y, targetY, 0.85, elapsed);
    const moving = Math.abs(split.x) + Math.abs(split.y) > 0.00005;
    layer.canvas.style.opacity = moving && texture ? "1" : "0";
    if (moving && texture) {
      renderer.paint(
        layer.canvas,
        splitShader,
        { v: [split.x, split.y], ...placementUniforms(image) },
        texture,
      );
    }
    return over || moving;
  });
  return combine(
    listen(element, {
      pointerenter: () => {
        over = true;
        layer.place(ratio);
        loop.wake();
      },
      pointerleave: () => {
        over = false;
        loop.wake();
      },
      pointermove: (event: PointerEvent) => {
        const at = pointerWithin(image, event);
        pointer.dx += (at.x - pointer.x) * 0.5;
        pointer.dy += (at.y - pointer.y) * 0.5;
        pointer.x = at.x;
        pointer.y = at.y;
        loop.wake();
      },
    }),
    () => loop.destroy(),
    () => texture?.release(),
    layer.remove,
  );
};

export const behaviours = { developReveal, pixelReveal, colourSplit };
export default { behaviours } satisfies EffectModule;
