import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { createSurface } from "../kit/surface.js";
import { approach } from "../maths/smoothing.js";
import { colourToRgb, createShaderPass, noiseFunctions } from "../kit/webgl.js";

/**
 * A slow liquid blend of four colours behind the content, gently stirred by the pointer.
 * One small WebGL shader. The page's stylesheet already paints the same colours as a
 * plain gradient (the static fallback), which is what shows without WebGL, before this
 * module loads, and as a still frame for people who ask for less motion.
 */
const shader = `${noiseFunctions}
uniform float t;uniform vec2 m;uniform vec2 r;uniform vec3 a;uniform vec3 b;uniform vec3 c;uniform vec3 d;uniform float g;
void main(){vec2 p=uv*vec2(r.x/r.y,1.)*1.6;p+=(m-.5)*.25;
vec2 q=vec2(n(p+t*.05),n(p+vec2(5.2,1.3)-t*.04));
vec2 w=vec2(n(p+3.*q+vec2(1.7,9.2)+t*.03),n(p+3.*q+vec2(8.3,2.8)));
float f=n(p+2.5*w);
vec3 col=mix(mix(a,b,smoothstep(.2,.8,f)),mix(c,d,smoothstep(.3,.9,w.x)),smoothstep(.2,.8,w.y));
col+=(h(uv*r+t)-.5)*g;gl_FragColor=vec4(col,1.);}`;

const liquidGradient: EffectBehaviour = (element, params, context) => {
  const surface = createSurface(element, context);
  const pass = createShaderPass(surface.canvas, shader);
  if (!pass) return surface.remove;
  ["one", "two", "three", "four"].forEach((name, index) => {
    const fallback = ["#7539fd", "#ff5c8a", "#ffb347", "#3ec6ff"][index]!;
    pass.set("abcd"[index]!, ...colourToRgb(readColour(params, name, fallback)));
  });
  pass.set("g", readNumber(params, "grain", 0.04));
  const speed = readNumber(params, "speed", 1);
  const pointer = { x: 0.5, y: 0.5 };
  const eased = { x: 0.5, y: 0.5 };
  let time = Math.random() * 100;
  const draw = () => {
    pass.set("r", surface.canvas.width, surface.canvas.height);
    pass.set("t", time);
    pass.set("m", eased.x, eased.y);
    pass.draw();
  };
  draw();
  if (context.reduced) return combine(() => pass.destroy(), surface.remove);
  const loop = createFrameLoop(element, (elapsed) => {
    time += (elapsed / 1000) * speed * (context.lowPower ? 0.6 : 1);
    eased.x = approach(eased.x, pointer.x, 0.95, elapsed);
    eased.y = approach(eased.y, pointer.y, 0.95, elapsed);
    draw();
    return true;
  });
  return combine(
    listen(element, {
      pointermove: (event: PointerEvent) => {
        const position = pointerWithin(element, event);
        pointer.x = position.x / 2 + 0.5;
        pointer.y = position.y / 2 + 0.5;
      },
    }),
    () => loop.destroy(),
    () => pass.destroy(),
    surface.remove,
  );
};

export const behaviours = { liquidGradient };
export default { behaviours } satisfies EffectModule;
