/**
 * The little WebGL every shader effect shares: one full-screen triangle, a fragment shader,
 * uniforms by name and pictures as textures. Returns undefined where WebGL isn't available,
 * and the effect then leaves the element's static look (its fallback colour or picture).
 */

const vertexShader = `attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;

export interface ShaderPass {
  gl: WebGLRenderingContext;
  /**
   * The browser draws WebGL on the processor, not a graphics card (no GPU, or it is blocked):
   * shader effects then draw smaller and less often, so scrolling stays smooth.
   */
  software: boolean;
  set(name: string, ...values: number[]): void;
  draw(): void;
  texture(image: TexImageSource): boolean;
  destroy(): void;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined;
}

export function createShaderPass(
  canvas: HTMLCanvasElement,
  fragmentShader: string,
): ShaderPass | undefined {
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) return undefined;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(
    gl,
    gl.FRAGMENT_SHADER,
    `precision mediump float;varying vec2 uv;${fragmentShader}`,
  );
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return undefined;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const locations = new Map<string, WebGLUniformLocation | null>();
  const where = (name: string) => {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
    return locations.get(name) ?? null;
  };
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "";
  return {
    gl,
    software: /swiftshader|llvmpipe|software|basic render/i.test(renderer),
    set(name, ...values) {
      const location = where(name);
      if (values.length === 1) gl.uniform1f(location, values[0]!);
      else if (values.length === 2) gl.uniform2f(location, values[0]!, values[1]!);
      else if (values.length === 3) gl.uniform3f(location, values[0]!, values[1]!, values[2]!);
      else gl.uniform4f(location, values[0]!, values[1]!, values[2]!, values[3]!);
    },
    draw() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    texture(image) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      for (const [name, value] of [
        [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
        [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
        [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
      ] as const) {
        gl.texParameteri(gl.TEXTURE_2D, name, value);
      }
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        return true;
      } catch {
        // A picture from another site without permission can't be read: keep the fallback.
        return false;
      }
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/** A colour from a param ("#7539fd") as three numbers from 0 to 1; grey for anything else. */
export function colourToRgb(colour: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour)?.[1];
  if (!hex) return [0.5, 0.5, 0.5];
  const value = Number.parseInt(hex, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Waits for a picture to finish loading. */
export function loaded(image: HTMLImageElement): Promise<HTMLImageElement> {
  return image.complete && image.naturalWidth
    ? Promise.resolve(image)
    : new Promise((resolve, reject) => {
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", reject, { once: true });
      });
}

/** GLSL value noise, shared by the shader effects. */
export const noiseFunctions = `float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}`;
