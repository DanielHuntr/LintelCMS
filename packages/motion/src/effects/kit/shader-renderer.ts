/**
 * One WebGL context for every shader background and picture effect on the page. Browsers
 * allow only a handful of contexts at once (and each costs memory), so rather than one per
 * element, a single hidden canvas draws each effect in turn and its picture is copied onto
 * the element's own plain 2D canvas. Shaders are compiled once and shared by every element
 * that uses them; each element passes all its own values with every frame.
 *
 * If the browser has no WebGL, or loses the context (a graphics driver reset, too many
 * tabs), `paint` returns false and the effect leaves its static look showing.
 */

export type UniformValue = number | readonly number[];

export interface ShaderTexture {
  /** Frees the texture. */
  release(): void;
}

export interface ShaderRenderer {
  /** WebGL runs on the processor rather than a graphics card: draw smaller and less often. */
  readonly software: boolean;
  /** Whether the shader compiles here; check once before relying on `paint`. */
  supports(shader: string): boolean;
  /** A picture as a texture; undefined when it can't be read (another site's, say). */
  texture(image: TexImageSource): ShaderTexture | undefined;
  /**
   * Draws `shader` at the target canvas's size with these values (and picture), then copies
   * it onto the target. False when nothing could be drawn.
   */
  paint(
    target: HTMLCanvasElement,
    shader: string,
    uniforms: Readonly<Record<string, UniformValue>>,
    picture?: ShaderTexture,
  ): boolean;
}

/** The largest picture one effect draws, across or down; bigger elements are drawn softer. */
export const largestDrawing = 2048;

const vertexShader = `attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;

interface Program {
  program: WebGLProgram;
  where: Map<string, WebGLUniformLocation | null>;
}

interface Texture extends ShaderTexture {
  image: TexImageSource;
  made?: WebGLTexture | null;
  /** Which context it was made in: a lost context's textures are gone. */
  generation: number;
}

let shared: ShaderRenderer | null | undefined;

/** The page's renderer, made the first time an effect asks; undefined without WebGL. */
export function shaderRenderer(): ShaderRenderer | undefined {
  if (shared === undefined) shared = createRenderer() ?? null;
  return shared ?? undefined;
}

function createRenderer(): ShaderRenderer | undefined {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) return undefined;
  let lost = false;
  let generation = 0;
  const programs = new Map<string, Program | null>();
  let buffer: WebGLBuffer | null = null;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    generation += 1;
    programs.clear();
    buffer = null;
  });
  const derivatives = gl.getExtension("OES_standard_derivatives") !== null;
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererName = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "";

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return undefined;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined;
  };

  const programFor = (source: string): Program | undefined => {
    if (programs.has(source)) return programs.get(source) ?? undefined;
    const usesDerivatives = source.includes("fwidth");
    const fragment =
      usesDerivatives && !derivatives
        ? undefined
        : compile(
            gl.FRAGMENT_SHADER,
            `${usesDerivatives ? "#extension GL_OES_standard_derivatives : enable\n" : ""}precision mediump float;varying vec2 uv;${source}`,
          );
    const vertex = compile(gl.VERTEX_SHADER, vertexShader);
    const program = gl.createProgram();
    let made: Program | null = null;
    if (fragment && vertex && program) {
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.bindAttribLocation(program, 0, "p");
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) made = { program, where: new Map() };
    }
    programs.set(source, made);
    return made ?? undefined;
  };

  const upload = (texture: Texture) => {
    if (texture.made && texture.generation === generation) return texture.made;
    const made = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, made);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    } catch {
      // A picture from another site without permission can't be read: keep the fallback.
      gl.deleteTexture(made);
      return undefined;
    }
    texture.made = made;
    texture.generation = generation;
    return made;
  };

  return {
    software: /swiftshader|llvmpipe|software|basic render/i.test(rendererName),
    supports: (shader) => !lost && programFor(shader) !== undefined,
    texture(image) {
      if (lost) return undefined;
      const texture: Texture = {
        image,
        generation,
        release: () => {
          if (texture.made && texture.generation === generation) gl.deleteTexture(texture.made);
          texture.made = null;
        },
      };
      return upload(texture) ? texture : undefined;
    },
    paint(target, shader, uniforms, picture) {
      if (lost || gl.isContextLost()) return false;
      const drawing = target.getContext("2d");
      const program = programFor(shader);
      if (!drawing || !program) return false;
      const width = Math.min(target.width, largestDrawing);
      const height = Math.min(target.height, largestDrawing);
      if (width < 1 || height < 1) return false;
      // The hidden canvas only ever grows: resizing it reallocates its memory.
      if (canvas.width < width) canvas.width = width;
      if (canvas.height < height) canvas.height = height;
      gl.useProgram(program.program);
      if (!buffer) {
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      }
      for (const [name, value] of Object.entries(uniforms)) {
        if (!program.where.has(name)) {
          program.where.set(name, gl.getUniformLocation(program.program, name));
        }
        const location = program.where.get(name) ?? null;
        const values = typeof value === "number" ? [value] : value;
        if (values.length === 1) gl.uniform1f(location, values[0]!);
        else if (values.length === 2) gl.uniform2f(location, values[0]!, values[1]!);
        else if (values.length === 3) gl.uniform3f(location, values[0]!, values[1]!, values[2]!);
        else gl.uniform4f(location, values[0]!, values[1]!, values[2]!, values[3]!);
      }
      if (picture) {
        const made = upload(picture as Texture);
        if (!made) return false;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, made);
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // The drawing sits in the bottom-left corner of the hidden canvas.
      drawing.clearRect(0, 0, target.width, target.height);
      drawing.drawImage(
        canvas,
        0,
        canvas.height - height,
        width,
        height,
        0,
        0,
        target.width,
        target.height,
      );
      return true;
    },
  };
}

/** Forgets the page's renderer, for tests. */
export function resetShaderRenderer(): void {
  shared = undefined;
}
