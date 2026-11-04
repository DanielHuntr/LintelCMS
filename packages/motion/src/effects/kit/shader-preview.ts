import { resolveColour } from "./css-colour.js";
import {
  customShaderFragment,
  explainCompilerLog,
  readCustomShader,
  type ShaderControl,
  type ShaderProblem,
} from "./custom-shader.js";
import { createRenderer, type CompiledShader } from "./shader-renderer.js";
import { stackPainter } from "./shader-stack.js";

/**
 * The live preview in the code box. It has a WebGL context of its own, so a shader that is
 * still being written can lose it without taking anything else on the screen with it. Code
 * goes through the same checks as on a page, then a trial on a tiny drawing.
 */

export type PreviewValues = Readonly<Record<string, number | string | boolean>>;

export interface ShaderPreview {
  /** Tries new code: what's wrong with it, or nothing if it now shows. */
  show(code: string): ShaderProblem[];
  /** The values of its controls. */
  setValues(values: PreviewValues): void;
  destroy(): void;
}

/** Longest a trial drawing may take, in milliseconds. */
const trialLimit = 120;

export function createShaderPreview(
  target: HTMLCanvasElement,
  onLost: () => void,
): ShaderPreview | undefined {
  const renderer = createRenderer();
  if (!renderer) return undefined;
  const painter = stackPainter(renderer);
  let shown: { program: CompiledShader; controls: readonly ShaderControl[] } | undefined;
  let values: PreviewValues = {};
  let frame = 0;
  let started = 0;
  const pointer = [0.5, 0.5];

  const uniforms = (size: readonly number[]) =>
    Object.fromEntries([
      ["time", (performance.now() - started) / 1000],
      ["scroll", 0.5],
      ["resolution", size],
      ["pointer", pointer],
      ...(shown?.controls ?? []).map((control) => {
        const value = values[control.name];
        if (control.kind === "colour") {
          const css = typeof value === "string" ? value : control.value;
          return [control.name, resolveColour(target, css, control.value)];
        }
        if (control.kind === "toggle") {
          return [control.name, (typeof value === "boolean" ? value : control.value) ? 1 : 0];
        }
        return [control.name, typeof value === "number" ? value : control.value];
      }),
    ]);

  const whole = () =>
    new Set(
      (shown?.controls ?? []).flatMap((control) =>
        control.kind === "toggle" || (control.kind === "slider" && control.whole)
          ? [control.name]
          : [],
      ),
    );

  const drawOn = (canvas: HTMLCanvasElement) =>
    shown &&
    painter.paint(canvas, null, [
      {
        program: shown.program,
        uniforms: uniforms([canvas.width, canvas.height]),
        whole: whole(),
        belowName: "lintelBelow",
        belowSizeName: "lintelBelowSize",
        blend: "normal",
        opacity: 1,
      },
    ]);

  const tick = () => {
    frame = requestAnimationFrame(tick);
    drawOn(target);
  };
  const follow = (event: PointerEvent) => {
    const box = target.getBoundingClientRect();
    pointer[0] = (event.clientX - box.left) / Math.max(box.width, 1);
    pointer[1] = 1 - (event.clientY - box.top) / Math.max(box.height, 1);
  };
  target.addEventListener("pointermove", follow);
  const stopWatching = renderer.watchContext((lost) => {
    if (!lost) return;
    cancelAnimationFrame(frame);
    frame = 0;
    shown = undefined;
    onLost();
  });

  return {
    show(code) {
      const read = readCustomShader(code);
      if (read.problems.length > 0) return read.problems;
      const fragment = customShaderFragment(read.code);
      const program = renderer.compile(fragment);
      if (!program) return explainCompilerLog(renderer.problem(fragment) ?? "");
      shown = { program, controls: read.controls };
      const trial = document.createElement("canvas");
      trial.width = trial.height = 16;
      drawOn(trial);
      painter.finish();
      drawOn(trial);
      if (painter.finish() > trialLimit) {
        shown = undefined;
        return [
          {
            line: 1,
            message: "Line 1: this takes too long to draw. Try fewer steps in its loops.",
          },
        ];
      }
      started ||= performance.now();
      if (!frame) tick();
      return [];
    },
    setValues(next) {
      values = next;
    },
    destroy() {
      cancelAnimationFrame(frame);
      stopWatching();
      target.removeEventListener("pointermove", follow);
      renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
