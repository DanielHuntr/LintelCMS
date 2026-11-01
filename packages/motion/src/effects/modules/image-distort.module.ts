import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { setStyles } from "../kit/styles.js";
import { approach } from "../maths/smoothing.js";
import { createShaderPass, loaded, noiseFunctions } from "../kit/webgl.js";

/**
 * Ripples a picture with flowing noise while the pointer is over it (or it has focus). The
 * picture itself stays in the page; a canvas copy lies over it only while distorting, so
 * the real picture is the fallback everywhere else.
 */
const shader = `${noiseFunctions}
uniform sampler2D s;uniform float t;uniform float k;uniform vec2 m;uniform float mode;
void main(){vec2 p=uv;float d=distance(uv,m);
vec2 o=vec2(n(uv*6.+t),n(uv*6.-t+4.))-.5;
if(mode>.5){o*=smoothstep(.45,0.,d)*2.;}
vec2 sp=p+o*k*.08;
vec4 col=vec4(texture2D(s,sp+vec2(k*.004,0)).r,texture2D(s,sp).g,texture2D(s,sp-vec2(k*.004,0)).b,1.);
gl_FragColor=col;}`;

const imageDistort: EffectBehaviour = (element, params, context) => {
  const image = element instanceof HTMLImageElement ? element : element.querySelector("img");
  if (!image || context.reduced) return;
  const holder = image.parentElement ?? element;
  const restoreHolder =
    getComputedStyle(holder).position === "static"
      ? setStyles(holder, { position: "relative" })
      : () => undefined;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 200ms",
  });
  holder.append(canvas);
  const pass = createShaderPass(canvas, shader);
  if (!pass) return combine(() => canvas.remove(), restoreHolder);
  pass.set("mode", readText(params, "focus", "whole") === "pointer" ? 1 : 0);
  const strength = readNumber(params, "strength", 1);
  let ready = false;
  void loaded(image).then(() => (ready = pass.texture(image)));
  const place = () => {
    const ratio = context.lowPower ? 1 : Math.min(devicePixelRatio || 1, 2);
    Object.assign(canvas.style, {
      left: `${image.offsetLeft}px`,
      top: `${image.offsetTop}px`,
      width: `${image.offsetWidth}px`,
      height: `${image.offsetHeight}px`,
    });
    canvas.width = image.offsetWidth * ratio;
    canvas.height = image.offsetHeight * ratio;
  };
  let amount = 0;
  let target = 0;
  let time = 0;
  const pointer = { x: 0.5, y: 0.5 };
  const loop = createFrameLoop(element, (elapsed) => {
    amount = approach(amount, target, 0.9, elapsed);
    time += elapsed / 1600;
    if (!ready) return target > 0;
    canvas.style.opacity = amount > 0.01 ? "1" : "0";
    pass.set("t", time);
    pass.set("k", amount * strength);
    pass.set("m", pointer.x, 1 - pointer.y);
    pass.draw();
    return amount > 0 || target > 0;
  });
  const start = () => {
    place();
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
    () => pass.destroy(),
    () => canvas.remove(),
    restoreHolder,
  );
};

export const behaviours = { imageDistort };
export default { behaviours } satisfies EffectModule;
