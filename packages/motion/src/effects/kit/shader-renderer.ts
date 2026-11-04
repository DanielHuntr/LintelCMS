/**
 * One WebGL context for every shader background and picture effect on the page. Browsers
 * allow only a handful of contexts at once (and each costs memory), so rather than one per
 * element, a single hidden canvas draws each effect in turn and its picture is copied onto
 * the element's own plain 2D canvas. Shaders are compiled once and shared by every element
 * that uses them; each element passes all its own values with every frame.
 *
 * If the browser has no WebGL, or loses the context (a graphics driver reset, too many
 * tabs), `paint` returns false and the effect leaves its static look showing.
 *
 * `compile`, `applyUniforms`, `useTriangle` and `show` are the lower level the layer stack
 * (`kit/shader-stack.ts`) draws with, in this same context.
 */

export type UniformValue = number | readonly number[];

export interface ShaderTexture {
  /** Frees the texture. */
  release(): void;
}

/** A compiled shader and where its values go. */
export interface CompiledShader {
  program: WebGLProgram;
  where: Map<string, WebGLUniformLocation | null>;
}

export interface ShaderRenderer {
  /** The shared context and its hidden canvas. */
  readonly gl: WebGLRenderingContext;
  readonly canvas: HTMLCanvasElement;
  /** Goes up each time a lost context comes back: anything made in the old one is gone. */
  readonly generation: number;
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
  /**
   * A whole fragment shader compiled as written (no shared first lines), remembered like the
   * others. Undefined when it fails; `problem` then says what the compiler said.
   */
  compile(fragment: string): CompiledShader | undefined;
  /** A look's shader, compiled with the shared first lines as `paint` does. */
  program(shader: string): CompiledShader | undefined;
  problem(fragment: string): string | undefined;
  /** Sets a program's values; `whole` names the ones the shader declares as int or bool. */
  applyUniforms(
    program: CompiledShader,
    uniforms: Readonly<Record<string, UniformValue>>,
    whole?: ReadonlySet<string>,
  ): void;
  /** Makes sure the one triangle every effect draws is in place. */
  useTriangle(): void;
  /** Copies the bottom-left of the hidden canvas onto the target. False if it can't. */
  show(target: HTMLCanvasElement, width: number, height: number): boolean;
  /** Called when the context is lost (true) and when it comes back (false). */
  watchContext(listener: (lost: boolean) => void): () => void;
}

/** The largest picture one effect draws, across or down; bigger elements are drawn softer. */
export const largestDrawing = 2048;

const vertexShader = `attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;

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

/**
 * Also makes a renderer of its own for a shader being written, so that when one still being
 * tried loses its context, nothing else on the screen goes with it.
 */
export function createRenderer(
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): ShaderRenderer | undefined {
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) return undefined;
  let lost = false;
  let generation = 0;
  const programs = new Map<string, CompiledShader | null>();
  const problems = new Map<string, string>();
  const watchers = new Set<(lost: boolean) => void>();
  let buffer: WebGLBuffer | null = null;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    watchers.forEach((watcher) => watcher(true));
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    generation += 1;
    programs.clear();
    problems.clear();
    buffer = null;
    watchers.forEach((watcher) => watcher(false));
  });
  const derivatives = gl.getExtension("OES_standard_derivatives") !== null;
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererName = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "";

  const compileStage = (type: number, source: string, key: string) => {
    const shader = gl.createShader(type);
    if (!shader) return undefined;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    problems.set(key, gl.getShaderInfoLog(shader) ?? "");
    return undefined;
  };

  const build = (key: string, full: string | undefined): CompiledShader | undefined => {
    if (programs.has(key)) return programs.get(key) ?? undefined;
    const fragment = full === undefined ? undefined : compileStage(gl.FRAGMENT_SHADER, full, key);
    const vertex = compileStage(gl.VERTEX_SHADER, vertexShader, key);
    const program = gl.createProgram();
    let made: CompiledShader | null = null;
    if (fragment && vertex && program) {
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.bindAttribLocation(program, 0, "p");
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) made = { program, where: new Map() };
      else problems.set(key, gl.getProgramInfoLog(program) ?? "");
    }
    programs.set(key, made);
    return made ?? undefined;
  };

  const programFor = (source: string): CompiledShader | undefined => {
    const usesDerivatives = /fwidth|dFdx/.test(source);
    return build(
      source,
      usesDerivatives && !derivatives
        ? undefined
        : `${usesDerivatives ? "#extension GL_OES_standard_derivatives : enable\n" : ""}precision mediump float;varying vec2 uv;${source}`,
    );
  };

  const applyUniforms: ShaderRenderer["applyUniforms"] = (program, uniforms, whole) => {
    for (const [name, value] of Object.entries(uniforms)) {
      if (!program.where.has(name)) {
        program.where.set(name, gl.getUniformLocation(program.program, name));
      }
      const location = program.where.get(name) ?? null;
      const values = typeof value === "number" ? [value] : value;
      if (whole?.has(name)) gl.uniform1i(location, Math.round(values[0]!));
      else if (values.length === 1) gl.uniform1f(location, values[0]!);
      else if (values.length === 2) gl.uniform2f(location, values[0]!, values[1]!);
      else if (values.length === 3) gl.uniform3f(location, values[0]!, values[1]!, values[2]!);
      else gl.uniform4f(location, values[0]!, values[1]!, values[2]!, values[3]!);
    }
  };

  const useTriangle = () => {
    if (buffer) return;
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  };

  const show: ShaderRenderer["show"] = (target, width, height) => {
    const drawing = target.getContext("2d");
    if (!drawing) return false;
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
    gl,
    canvas,
    get generation() {
      return generation;
    },
    software: /swiftshader|llvmpipe|software|basic render/i.test(rendererName),
    supports: (shader) => !lost && programFor(shader) !== undefined,
    compile: (fragment) => (lost ? undefined : build(fragment, fragment)),
    program: (shader) => (lost ? undefined : programFor(shader)),
    problem: (fragment) => problems.get(fragment),
    applyUniforms,
    useTriangle,
    show,
    watchContext(listener) {
      watchers.add(listener);
      return () => watchers.delete(listener);
    },
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
      const program = programFor(shader);
      if (!target.getContext("2d") || !program) return false;
      const width = Math.min(target.width, largestDrawing);
      const height = Math.min(target.height, largestDrawing);
      if (width < 1 || height < 1) return false;
      // The hidden canvas only ever grows: resizing it reallocates its memory.
      if (canvas.width < width) canvas.width = width;
      if (canvas.height < height) canvas.height = height;
      gl.useProgram(program.program);
      useTriangle();
      applyUniforms(program, uniforms);
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
      return show(target, width, height);
    },
  };
}

/** Forgets the page's renderer, for tests. */
export function resetShaderRenderer(): void {
  shared = undefined;
}
