import type { Rgb } from "../maths/readable.js";
import {
  largestDrawing,
  type CompiledShader,
  type ShaderRenderer,
  type UniformValue,
} from "./shader-renderer.js";

/**
 * Drawing a stack of layers in the page's one WebGL context. Each layer is drawn to a texture
 * of its own, then mixed with everything under it by a small shader, the way a design tool's
 * blend modes work (the W3C compositing formula, on premultiplied colour). The first texture
 * starts as the section's background where that's a plain colour, so a blend mode has
 * something to blend with. Textures only ever grow; `ls` tells shaders how much is in use.
 */

export const blendCodes = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  "soft-light": 4,
  add: 5,
  difference: 6,
} as const;

export type BlendName = keyof typeof blendCodes;

export interface StackStep {
  program: CompiledShader;
  uniforms: Readonly<Record<string, UniformValue>>;
  /** The values the shader declares as int or bool. */
  whole?: ReadonlySet<string>;
  /** The names under which this shader reads the layers below, and how much is in use. */
  belowName: string;
  belowSizeName: string;
  blend: BlendName;
  opacity: number;
}

const blendShader = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;uniform sampler2D u,o;uniform vec2 ls;uniform float mode,op;
vec3 hard(vec3 x,vec3 y){return mix(2.*x*y,1.-2.*(1.-x)*(1.-y),step(.5,y));}
vec3 mixed(vec3 x,vec3 y){
if(mode<.5)return y;if(mode<1.5)return x*y;if(mode<2.5)return x+y-x*y;if(mode<3.5)return hard(y,x);
if(mode<4.5)return (1.-2.*y)*x*x+2.*y*x;if(mode<5.5)return min(x+y,1.);return abs(x-y);}
void main(){vec2 p=uv*ls;vec4 x=texture2D(u,p),y=texture2D(o,p)*op;
vec3 xs=x.a>0.?x.rgb/x.a:vec3(0.),ys=y.a>0.?y.rgb/y.a:vec3(0.);
gl_FragColor=vec4(y.rgb*(1.-x.a)+mixed(xs,ys)*y.a*x.a+x.rgb*(1.-y.a),y.a+x.a*(1.-y.a));}`;

const copyShader = `precision mediump float;varying vec2 uv;uniform sampler2D u;uniform vec2 ls;
void main(){gl_FragColor=texture2D(u,uv*ls);}`;

interface Surface {
  texture: WebGLTexture;
  frame: WebGLFramebuffer;
}

export interface StackPainter {
  /** Draws the steps onto the target. False if nothing could be drawn. */
  paint(target: HTMLCanvasElement, seed: Rgb | null, steps: readonly StackStep[]): boolean;
  /** Waits for the graphics card and says how long that took, in milliseconds. */
  finish(): number;
}

const painters = new WeakMap<ShaderRenderer, StackPainter>();

export function stackPainter(renderer: ShaderRenderer): StackPainter {
  let painter = painters.get(renderer);
  if (!painter) painters.set(renderer, (painter = createPainter(renderer)));
  return painter;
}

function createPainter(renderer: ShaderRenderer): StackPainter {
  const { gl, canvas } = renderer;
  let surfaces: Surface[] = [];
  let generation = -1;
  let across = 0;
  let down = 0;

  const makeSurface = (): Surface | undefined => {
    const texture = gl.createTexture();
    const frame = gl.createFramebuffer();
    if (!texture || !frame) return undefined;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, across, down, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [name, value] of [
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
      [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    ] as const) {
      gl.texParameteri(gl.TEXTURE_2D, name, value);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, frame };
  };

  const ensureSurfaces = (width: number, height: number) => {
    if (generation === renderer.generation && width <= across && height <= down) return true;
    if (generation === renderer.generation) {
      for (const surface of surfaces) {
        gl.deleteTexture(surface.texture);
        gl.deleteFramebuffer(surface.frame);
      }
    }
    generation = renderer.generation;
    across = Math.max(across, width);
    down = Math.max(down, height);
    surfaces = [makeSurface(), makeSurface(), makeSurface()].filter(
      (surface): surface is Surface => surface !== undefined,
    );
    return surfaces.length === 3;
  };

  const bindTexture = (unit: number, texture: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  };

  return {
    finish() {
      const start = performance.now();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      return performance.now() - start;
    },
    paint(target, seed, steps) {
      if (gl.isContextLost()) return false;
      const blend = renderer.compile(blendShader);
      const copy = renderer.compile(copyShader);
      const width = Math.min(target.width, largestDrawing);
      const height = Math.min(target.height, largestDrawing);
      if (!blend || !copy || width < 1 || height < 1 || !ensureSurfaces(width, height)) {
        return false;
      }
      if (canvas.width < width) canvas.width = width;
      if (canvas.height < height) canvas.height = height;
      renderer.useTriangle();
      gl.viewport(0, 0, width, height);
      const used = [width / across, height / down];
      const layer = surfaces[2]!;
      let [under, spare] = surfaces as [Surface, Surface];

      gl.bindFramebuffer(gl.FRAMEBUFFER, under.frame);
      gl.clearColor(seed?.[0] ?? 0, seed?.[1] ?? 0, seed?.[2] ?? 0, seed ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      for (const step of steps) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.frame);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(step.program.program);
        bindTexture(1, under.texture);
        const { whole } = step;
        const plain = Object.fromEntries(
          Object.entries(step.uniforms).filter(([name]) => !whole?.has(name)),
        );
        renderer.applyUniforms(step.program, { ...plain, [step.belowSizeName]: used });
        renderer.applyUniforms(
          step.program,
          {
            [step.belowName]: 1,
            ...Object.fromEntries(
              [...(whole ?? [])].map((name) => [name, step.uniforms[name] ?? 0]),
            ),
          },
          new Set([step.belowName, ...(whole ?? [])]),
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.bindFramebuffer(gl.FRAMEBUFFER, spare.frame);
        gl.useProgram(blend.program);
        bindTexture(0, under.texture);
        bindTexture(1, layer.texture);
        renderer.applyUniforms(blend, { u: 0, o: 1 }, new Set(["u", "o"]));
        renderer.applyUniforms(blend, {
          ls: used,
          mode: blendCodes[step.blend] ?? 0,
          op: step.opacity,
        });
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        [under, spare] = [spare, under];
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(copy.program);
      bindTexture(0, under.texture);
      renderer.applyUniforms(copy, { u: 0 }, new Set(["u"]));
      renderer.applyUniforms(copy, { ls: used });
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return renderer.show(target, width, height);
    },
  };
}
