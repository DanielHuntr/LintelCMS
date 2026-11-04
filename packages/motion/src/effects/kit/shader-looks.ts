import type { EffectParams } from "../effect-types.js";
import { readNumber, readSwitch, readText } from "./params.js";
import { noiseFunctions } from "./shader-source.js";
import type { UniformValue } from "./shader-renderer.js";

/**
 * The moving backgrounds, as shaders and what the page needs to know about each. A look can
 * run alone (`modules/shader-backgrounds`) or as a layer (`modules/shader-stack`). The
 * settings under "More settings" start at values that leave each look exactly as it was.
 */

/** Uniforms every look gets: time, strength, pixel ratio, nearness, size, pointer, colours. */
export const lookHeader = `${noiseFunctions}
uniform float t,k,d,e,sc,an,so,dt,gn,hc,lo,pt;uniform vec2 r,m;uniform vec3 a,b,c;
float f(vec2 p){float v=0.,s=.5;for(int i=0;i<4;i++){v+=s*n(p);p=mat2(.8,.6,-.6,.8)*p*2.03+vec2(1.7,9.2);s*=.5;}return v;}
vec2 turn(vec2 p,float w){vec2 o=vec2(w*.5,.5);float s=sin(an),q=cos(an);return mat2(q,s,-s,q)*(p-o)/sc+o;}
float soft(){return pow(4.,1.-2.*so);}
`;

/** Soft pools of two colours drifting over the section's own background. */
const mesh = `${lookHeader}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w);float s=t*.05,u=soft();
p+=(vec2(f(p*1.1+vec2(s,-s)),f(p*1.1+vec2(4.1-s,2.3+s)))-.5)*(.3+.3*k)+(m-.5)*.05;
vec2 o1=vec2(w*(.22+.16*sin(s*1.3)),.7+.18*cos(s*1.1));
vec2 o2=vec2(w*(.8+.12*cos(s*.9+1.)),.32+.2*sin(s*1.4+2.));
vec2 o3=vec2(w*(.52+.26*sin(s*.7+4.)),-.05+.12*sin(s+1.));
float w1=exp(-3.2*u*dot(p-o1,p-o1)),w2=exp(-3.2*u*dot(p-o2,p-o2)),w3=exp(-4.*u*dot(p-o3,p-o3));
float al=w1+w2+w3*.8;vec3 col=(a*w1+b*w2+mix(a,c,hc)*w3*.8)/max(al,1e-3);
al=clamp(al*(.35+.65*k),0.,1.)+(h(gl_FragCoord.xy+fract(t))-.5)/96.;
gl_FragColor=vec4(col*al,al);}`;

/** Light on the bottom of a pool: bright threads that slowly fold and drift. */
const light = `${lookHeader}
float ridge(vec2 p){return 1.-abs(n(p)*2.-1.);}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w)*2.6+(m-.5)*.15;float s=t*.09,u=soft();
vec2 q=p+(vec2(f(p*.5+s),f(p*.5-s+3.))-.5)*1.6;
float l=pow(ridge(q+vec2(s,0.))*ridge(q*1.3-vec2(0.,s*1.2)+5.),4.*u);
l+=.35*pow(ridge(q*.7+vec2(-s*.6,s*.4)+9.),6.*u);
l*=mix(.45,1.1,uv.y)*(.4+1.1*k);
vec3 col=mix(a*(1.-.06*k),b,clamp(l,0.,1.));
col+=(h(gl_FragCoord.xy+fract(t))-.5)/128.;gl_FragColor=vec4(col,1.);}`;

/**
 * Specks at three depths: far ones small and sharp, near ones larger and soft. `gn` is above
 * 1 on light sections, where a dark speck on a pale ground needs more presence than the
 * same speck in light on a dark one. The near ones gain less, or they read as smudges.
 */
const dust = `${lookHeader}
float speck(vec2 p,float scale,float seed,float rise,float size,float edge){
p*=scale;p.y-=t*rise;vec2 id=floor(p),g=fract(p);float z=h(id+seed);if(z<.62)return 0.;
vec2 c=.3+.4*vec2(h(id+seed+1.3),h(id+seed+7.1))+.1*vec2(sin(t*.3+z*40.),cos(t*.23+z*30.));
size*=(.55+.9*h(id+seed+3.7))*(1.+(gn-1.)*.3);float tw=.5+.5*sin(t*(.4+z)+z*20.);tw=mix(tw,1.,(gn-1.)*.3);
return smoothstep(size,size*min(edge*(2.-2.*so),.95),length(g-c))*tw;}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w);vec2 q=m-.5;
vec2 mp=vec2(m.x*w,m.y);float near=e*exp(-dot(p-mp,p-mp)*10.);
float v=speck(p+q*.012,24.,0.,.25,.06,.2)*.6+speck(p+q*.03,12.,3.,.12,.07,.3)*.7+speck(p+q*.06,5.,7.,.05,.13,0.)*.4/sqrt(gn);
float al=clamp(v*(.35+.65*k)*(1.+near*.8)*gn,0.,1.);gl_FragColor=vec4(a*al,al);}`;

/**
 * Contour lines of a slowly shifting landscape, every fifth line a little stronger. The land
 * is built from three smooth layers (noise with a smoother curve than the shared one, whose
 * cell edges bent the lines), and a line's width comes from the land's true slope, so lines
 * keep one width whichever way they run.
 */
const contours = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#endif
${lookHeader}
float sn(vec2 p){vec2 i=floor(p),g=fract(p);g=g*g*g*(g*(g*6.-15.)+10.);return mix(mix(h(i),h(i+vec2(1,0)),g.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),g.x),g.y);}
float land(vec2 p){return sn(p*1.3)+.42*sn(mat2(.8,.6,-.6,.8)*p*2.3+3.1)+.16*sn(mat2(.6,-.8,.8,.6)*p*4.1+7.7);}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w)*.9;float s=t*.012;
float lv=land(p+vec2(s,-s*.7))*dt*1.15;
float fr=abs(fract(lv-.5)-.5)/max(length(vec2(dFdx(lv),dFdy(lv))),1e-4);
float wd=.1+.8*so;float line=1.-smoothstep(d*.5-wd,d*.5+wd,fr);
float major=mod(floor(lv+.5),5.)<.5?1.:.55;
float al=line*major*(.25+.75*k);gl_FragColor=vec4(a*al,al);}`;

export interface Look {
  shader: string;
  /** Canvas pixels per screen pixel: soft looks need fewer. */
  resolution: number;
  /** Whether the look paints the whole background itself, or lays over the section's own. */
  covers: boolean;
  /** Its colours' settings, and what they are when left unset. */
  colours: readonly string[];
  defaults: readonly string[];
  /** Follows the pointer (a little). */
  pointer: boolean;
  /** What "detail" is when left unset. */
  detail?: number;
  /** Reads the layers under it. */
  filter?: boolean;
}

export const looks: Record<string, Look> = {
  mesh: {
    shader: mesh,
    resolution: 0.4,
    covers: false,
    colours: ["one", "two", "three"],
    defaults: ["#e8d5c0", "#c5d3dc", ""],
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
    colours: ["colour"],
    defaults: ["currentColor"],
    pointer: true,
  },
  contours: {
    shader: contours,
    resolution: 1,
    covers: false,
    colours: ["colour"],
    defaults: ["currentColor"],
    pointer: false,
    detail: 16,
  },
};

const turnsToRadians = Math.PI / 180;

/** The uniforms that come straight from a look's number settings. */
export function lookNumbers(look: Look, params: EffectParams): Record<string, UniformValue> {
  return {
    k: readNumber(params, "strength", 0.5),
    sc: Math.max(readNumber(params, "scale", 1), 0.05),
    an: readNumber(params, "direction", 0) * turnsToRadians,
    so: readNumber(params, "softness", 0.5),
    dt: readNumber(params, "detail", look.detail ?? 1),
    pt: Number(readText(params, "pattern", "0")) || (readSwitch(params, "keep", false) ? 1 : 0),
  };
}
