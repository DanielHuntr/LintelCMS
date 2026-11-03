import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { addPictureLayer, drawingRatio, findPicture } from "../kit/layers.js";
import { loaded } from "../kit/loaded.js";
import { shaderRenderer, type ShaderTexture } from "../kit/shader-renderer.js";
import { noiseFunctions } from "../kit/shader-source.js";
import { pictureLookup, pictureTexture, placementUniforms } from "../kit/picture-shader.js";
import { approach } from "../maths/smoothing.js";

/**
 * Ripples a picture with flowing noise while the pointer is over it (or it has focus). The
 * picture itself stays in the page; a canvas copy lies over it only while distorting, so
 * the real picture is the fallback everywhere else. Drawn through the page's shared WebGL
 * context, with the other shader effects.
 */
const shader = `${noiseFunctions}${pictureLookup}
uniform float t;uniform float k;uniform vec2 m;uniform float mode;
void main(){vec2 p=uv;float d=distance(uv,m);
vec2 o=vec2(n(uv*6.+t),n(uv*6.-t+4.))-.5;
if(mode>.5){o*=smoothstep(.45,0.,d)*2.;}
vec2 sp=p+o*k*.08;
gl_FragColor=vec4(edge(sp+vec2(k*.004,0)).r,edge(sp).g,edge(sp-vec2(k*.004,0)).b,1.)*pic(uv).a;}`;

const imageDistort: EffectBehaviour = (element, params, context) => {
  const image = findPicture(element);
  if (!image || context.reduced) return;
  const renderer = shaderRenderer();
  if (!renderer?.supports(shader)) return;
  const layer = addPictureLayer(image);
  Object.assign(layer.canvas.style, { opacity: "0", transition: "opacity 200ms" });
  const focus = readText(params, "focus", "whole") === "pointer" ? 1 : 0;
  const strength = readNumber(params, "strength", 1);
  const ratio = drawingRatio(context, { software: renderer.software });
  let texture: ShaderTexture | undefined;
  void loaded(image)
    .then(async () => (texture = await pictureTexture(renderer, image)))
    .catch(() => undefined);
  let amount = 0;
  let target = 0;
  let time = 0;
  const pointer = { x: 0.5, y: 0.5 };
  const loop = createFrameLoop(element, (elapsed) => {
    amount = approach(amount, target, 0.9, elapsed);
    time += elapsed / 1600;
    if (!texture) return target > 0;
    layer.canvas.style.opacity = amount > 0.01 ? "1" : "0";
    renderer.paint(
      layer.canvas,
      shader,
      {
        t: time,
        k: amount * strength,
        m: [pointer.x, 1 - pointer.y],
        mode: focus,
        ...placementUniforms(image),
      },
      texture,
    );
    return amount > 0 || target > 0;
  });
  const start = () => {
    layer.place(ratio);
    target = 1;
    loop.wake();
  };
  const stop = () => {
    target = 0;
    loop.wake();
  };
  return combine(
    listen(element, {
      pointerenter: start,
      pointerleave: stop,
      focusin: start,
      focusout: stop,
      pointermove: (event: PointerEvent) => {
        const position = pointerWithin(image, event);
        pointer.x = position.x / 2 + 0.5;
        pointer.y = position.y / 2 + 0.5;
      },
    }),
    () => loop.destroy(),
    () => texture?.release(),
    layer.remove,
  );
};

export const behaviours = { imageDistort };
export default { behaviours } satisfies EffectModule;
