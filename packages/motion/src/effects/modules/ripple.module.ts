import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";
import { createSurface } from "../kit/surface.js";
import { createShaderPass, loaded } from "../kit/webgl.js";

/**
 * Water ripples spreading from where the pointer moves or taps (or from the middle, when it
 * gets keyboard focus). Over a picture the ripples bend it; over anything else they are
 * drawn as soft rings of light. Up to eight ripples at once, each a few uniforms: no
 * simulation to run, so it costs nothing once the water is still.
 */
const shader = `uniform sampler2D s;uniform float hasImage;uniform vec2 r;uniform vec4 drops[8];uniform float strength;
void main(){vec2 o=vec2(0.);float light=0.;
for(int i=0;i<8;i++){vec4 d=drops[i];if(d.w<=0.)continue;
vec2 v=(uv-d.xy)*vec2(r.x/r.y,1.);float dist=length(v);float front=d.z*.6;
float wave=sin((dist-front)*60.)*exp(-abs(dist-front)*18.)*d.w;
o+=normalize(v+1e-4)*wave*.012*strength;light+=wave*.25*strength;}
if(hasImage>.5){gl_FragColor=texture2D(s,uv+o)+vec4(vec3(light*.4),0.);}
else{gl_FragColor=vec4(vec3(1.),clamp(light,0.,1.)*.6);}}`;

const waterRipple: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const image = element.querySelector("img");
  const surface = createSurface(element, context, { under: false });
  const pass = createShaderPass(surface.canvas, shader);
  if (!pass) return surface.remove;
  let hasImage = false;
  surface.canvas.style.opacity = image ? "0" : "1";
  if (image) {
    void loaded(image).then(() => {
      hasImage = pass.texture(image);
      pass.set("hasImage", hasImage ? 1 : 0);
    });
  }
  pass.gl.enable(pass.gl.BLEND);
  pass.gl.blendFunc(pass.gl.SRC_ALPHA, pass.gl.ONE_MINUS_SRC_ALPHA);
  pass.set("strength", readNumber(params, "strength", 1));
  const drops: Array<{ x: number; y: number; age: number }> = [];
  const loop = createFrameLoop(element, (elapsed) => {
    drops.forEach((drop) => (drop.age += elapsed / 1000));
    while (drops.length && drops[0]!.age > 2.2) drops.shift();
    pass.set("r", surface.canvas.width, surface.canvas.height);
    for (let index = 0; index < 8; index += 1) {
      const drop = drops[index];
      pass.set(
        `drops[${index}]`,
        drop?.x ?? 0,
        drop?.y ?? 0,
        drop?.age ?? 0,
        drop ? Math.max(0, 1 - drop.age / 2.2) : 0,
      );
    }
    surface.canvas.style.opacity = hasImage && drops.length === 0 ? "0" : "1";
    pass.draw();
    return drops.length > 0;
  });
  const add = (x: number, y: number) => {
    drops.push({ x, y, age: 0 });
    if (drops.length > 8) drops.shift();
    loop.wake();
  };
  const onMove = readText(params, "trigger", "move") === "move";
  let last = 0;
  const at = (event: PointerEvent) => {
    const box = element.getBoundingClientRect();
    add((event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height);
  };
  return combine(
    listen(element, {
      pointerdown: at,
      pointermove: (event: PointerEvent) => {
        if (!onMove || event.timeStamp - last < 140) return;
        last = event.timeStamp;
        at(event);
      },
      focusin: () => add(0.5, 0.5),
    }),
    () => loop.destroy(),
    () => pass.destroy(),
    surface.remove,
  );
};

export const behaviours = { waterRipple };
export default { behaviours } satisfies EffectModule;
