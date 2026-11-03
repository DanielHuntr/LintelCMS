import type { EffectBehaviour, EffectModule, EffectParams } from "../effect-types.js";
import { resolveColour, wordColours } from "../kit/css-colour.js";
import { createFrameLoop } from "../kit/frames.js";
import { addBackdrop, drawingRatio, sizeCanvas } from "../kit/layers.js";
import { listen } from "../kit/listen.js";
import { readNumber, readSwitch, readText } from "../kit/params.js";
import { pointerWithin } from "../kit/pointer.js";
import { shaderRenderer, type UniformValue } from "../kit/shader-renderer.js";
import { setStyles } from "../kit/styles.js";
import { noiseFunctions } from "../kit/shader-source.js";
import { mixRgb, scrimFor, type Rgb } from "../maths/readable.js";
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

/** Uniforms every look gets: time, size, pointer, colours, strength, pixel ratio. */
const header = `${noiseFunctions}
uniform float t,k,d,e;uniform vec2 r,m;uniform vec3 a,b;
float f(vec2 p){float v=0.,s=.5;for(int i=0;i<4;i++){v+=s*n(p);p=mat2(.8,.6,-.6,.8)*p*2.03+vec2(1.7,9.2);s*=.5;}return v;}
`;

/** Soft pools of two colours drifting over the section's own background. */
const mesh = `${header}
void main(){float w=r.x/r.y;vec2 p=vec2(uv.x*w,uv.y);float s=t*.05;
p+=(vec2(f(p*1.1+vec2(s,-s)),f(p*1.1+vec2(4.1-s,2.3+s)))-.5)*(.3+.3*k)+(m-.5)*.05;
vec2 o1=vec2(w*(.22+.16*sin(s*1.3)),.7+.18*cos(s*1.1));
vec2 o2=vec2(w*(.8+.12*cos(s*.9+1.)),.32+.2*sin(s*1.4+2.));
vec2 o3=vec2(w*(.52+.26*sin(s*.7+4.)),-.05+.12*sin(s+1.));
float w1=exp(-3.2*dot(p-o1,p-o1)),w2=exp(-3.2*dot(p-o2,p-o2)),w3=exp(-4.*dot(p-o3,p-o3));
float al=w1+w2+w3*.8;vec3 col=(a*w1+b*w2+a*w3*.8)/max(al,1e-3);
al=clamp(al*(.35+.65*k),0.,1.)+(h(gl_FragCoord.xy+fract(t))-.5)/96.;
gl_FragColor=vec4(col*al,al);}`;

/** Light on the bottom of a pool: bright threads that slowly fold and drift. */
const light = `${header}
float ridge(vec2 p){return 1.-abs(n(p)*2.-1.);}
void main(){float w=r.x/r.y;vec2 p=vec2(uv.x*w,uv.y)*2.6+(m-.5)*.15;float s=t*.09;
vec2 q=p+(vec2(f(p*.5+s),f(p*.5-s+3.))-.5)*1.6;
float l=pow(ridge(q+vec2(s,0.))*ridge(q*1.3-vec2(0.,s*1.2)+5.),4.);
l+=.35*pow(ridge(q*.7+vec2(-s*.6,s*.4)+9.),6.);
l*=mix(.45,1.1,uv.y)*(.4+1.1*k);
vec3 col=mix(a*(1.-.06*k),b,clamp(l,0.,1.));
col+=(h(gl_FragCoord.xy+fract(t))-.5)/128.;gl_FragColor=vec4(col,1.);}`;

/** Specks at three depths: far ones small and sharp, near ones larger and soft. */
const dust = `${header}
float speck(vec2 p,float scale,float seed,float rise,float size,float edge){
p*=scale;p.y-=t*rise;vec2 id=floor(p),g=fract(p);float z=h(id+seed);if(z<.62)return 0.;
vec2 c=.3+.4*vec2(h(id+seed+1.3),h(id+seed+7.1))+.1*vec2(sin(t*.3+z*40.),cos(t*.23+z*30.));
size*=.55+.9*h(id+seed+3.7);float tw=.5+.5*sin(t*(.4+z)+z*20.);
return smoothstep(size,size*edge,length(g-c))*tw;}
void main(){float w=r.x/r.y;vec2 p=vec2(uv.x*w,uv.y);vec2 q=m-.5;
vec2 mp=vec2(m.x*w,m.y);float near=e*exp(-dot(p-mp,p-mp)*10.);
float v=speck(p+q*.012,24.,0.,.25,.06,.2)*.6+speck(p+q*.03,12.,3.,.12,.07,.3)*.7+speck(p+q*.06,5.,7.,.05,.13,0.)*.4;
float al=clamp(v*(.35+.65*k)*(1.+near*.8),0.,1.);gl_FragColor=vec4(a*al,al);}`;

/** Contour lines of a slowly shifting landscape, every fifth line a little stronger. */
const contours = `${header}
void main(){float w=r.x/r.y;vec2 p=vec2(uv.x*w,uv.y)*.9;float s=t*.012;
float h1=f(p+vec2(s,-s*.7))+.6*f(p*.4-vec2(s*.5,0.)+3.);float lv=h1*16.;
float fr=abs(fract(lv-.5)-.5)/max(fwidth(lv),1e-4);
float line=1.-smoothstep(d*.5-.5,d*.5+.5,fr);
float major=mod(floor(lv+.5),5.)<.5?1.:.55;
float al=line*major*(.25+.75*k);gl_FragColor=vec4(a*al,al);}`;

interface Look {
  shader: string;
  /** Canvas pixels per screen pixel: soft looks need fewer. */
  resolution: number;
  /** Whether the look paints the whole background itself, or lays over the section's own. */
  covers: boolean;
  /** Its two colours' settings, and what they are when left unset. */
  colours: readonly [string, string];
  defaults: readonly [string, string];
  /** Follows the pointer (a little). */
  pointer: boolean;
}

const looks: Record<string, Look> = {
  mesh: {
    shader: mesh,
    resolution: 0.4,
    covers: false,
    colours: ["one", "two"],
    defaults: ["#e8d5c0", "#c5d3dc"],
    pointer: true,
  },
  light: {
    shader: light,
    resolution: 0.5,
    covers: true,
    colours: ["background", "light"],
    defaults: ["#dfe9e6", "#ffffff"],
    pointer: true,
  },
  dust: {
    shader: dust,
    resolution: 1,
    covers: false,
    colours: ["colour", "colour"],
    defaults: ["currentColor", "currentColor"],
    pointer: true,
  },
  contours: {
    shader: contours,
    resolution: 1,
    covers: false,
    colours: ["colour", "colour"],
    defaults: ["currentColor", "currentColor"],
    pointer: false,
  },
};

/** The look's colours, as the shader and the contrast check need them. */
function lookColours(element: HTMLElement, look: Look, params: EffectParams): [Rgb, Rgb] {
  const read = (index: 0 | 1) => {
    const fallback = look.defaults[index];
    const value = readText(params, look.colours[index], fallback);
    return value === "currentColor"
      ? resolveColour(element, getComputedStyle(element).color, "#808080")
      : resolveColour(element, value, fallback === "currentColor" ? "#808080" : fallback);
  };
  return [read(0), read(1)];
}

/** The section's own background colour (or the nearest one behind it), for looks laid over it. */
function backgroundBehind(element: HTMLElement): Rgb {
  for (let at: HTMLElement | null = element; at; at = at.parentElement) {
    const css = getComputedStyle(at).backgroundColor;
    if (!/^(transparent|rgba\(.*,\s*0\))$/.test(css)) return resolveColour(at, css, "#ffffff");
  }
  return [1, 1, 1];
}

/**
 * The colours words end up on: for a look that covers the section, its own colours; for one
 * laid over the section's background, that background with the look at full strength.
 */
function shadesUnder(element: HTMLElement, look: Look, colours: [Rgb, Rgb], strength: number) {
  if (look.covers) return [colours[0], mixRgb(colours[0], colours[1], 0.3 + 0.6 * strength)];
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
  let painted = false;
  const uniforms = (): Record<string, UniformValue> => ({
    t: time,
    k: strength,
    d: ratio,
    e: eased.near,
    r: [backdrop.canvas.width, backdrop.canvas.height],
    m: [eased.x, eased.y],
    a: colours[0],
    b: colours[1],
  });
  const draw = () => {
    sizeCanvas(backdrop.canvas, element.clientWidth, element.clientHeight, ratio);
    const drew = renderer.paint(backdrop.canvas, look.shader, uniforms());
    backdrop.canvas.style.visibility = drew ? "" : "hidden";
    // Once the drawing shows, the static fallback under it steps aside.
    if (drew && !painted) {
      painted = true;
      cleanups.push(setStyles(element, { "background-image": "none" }));
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
