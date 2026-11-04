/**
 * Reading a fragment shader someone pasted in. The code is not trusted: this checks its size,
 * what it uses and how much work it can do for each pixel before any graphics card sees it,
 * and turns its declared uniforms into controls. The same checks run in the code box, on the
 * server when it is saved, and on the page before it is compiled. Pure, with no browser in
 * it; see docs/decisions/0066-shader-studio.md and the docs page "Custom shaders".
 *
 * A control is a comment after a uniform:
 *
 *   uniform float rings; // @slider "How many rings" min=1 max=20 step=1 value=8
 *   uniform vec3 tint;   // @colour "Ring colour" value=#ff6a3d
 *   uniform bool flip;   // @toggle "Turn inside out" value=off
 *
 * `// @name Soft rings` and `// @fallback #101820` name the shader and set the plain
 * background that shows where it can't run. A uniform with no comment still gets a control.
 */

export const customShaderLimits = {
  /** Bytes of code. */
  size: 16_384,
  lines: 800,
  controls: 12,
  /** How many times the code may repeat work for each pixel, loops inside loops multiplied. */
  stepsPerPixel: 8_192,
} as const;

/** What Lintel provides, so a shader can't declare them itself. */
const provided = ["time", "resolution", "pointer", "scroll", "uv", "below"];

export interface ShaderProblem {
  /** Counted from 1, in what was typed. */
  line: number;
  message: string;
}

export type ShaderControl =
  | {
      kind: "slider";
      name: string;
      label: string;
      min: number;
      max: number;
      step: number;
      value: number;
      /** Declared as an int. */
      whole: boolean;
    }
  | { kind: "colour"; name: string; label: string; value: string }
  | { kind: "toggle"; name: string; label: string; value: boolean };

export interface ReadShader {
  /** The code without its comments, on the same lines, as the graphics card gets it. */
  code: string;
  controls: ShaderControl[];
  name?: string;
  fallback?: string;
  problems: ShaderProblem[];
}

/** Comments replaced by spaces, keeping every line where it was; and each line's comment. */
function splitComments(source: string): { code: string; comments: Map<number, string> } {
  const comments = new Map<number, string>();
  let code = "";
  let line = 1;
  for (let at = 0; at < source.length;) {
    const pair = source.slice(at, at + 2);
    if (pair === "//") {
      const end = source.indexOf("\n", at);
      const stop = end === -1 ? source.length : end;
      comments.set(line, `${comments.get(line) ?? ""}${source.slice(at + 2, stop)}`);
      code += " ".repeat(stop - at);
      at = stop;
    } else if (pair === "/*") {
      const end = source.indexOf("*/", at + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (const character of source.slice(at, stop)) {
        code += character === "\n" ? "\n" : " ";
        if (character === "\n") line += 1;
      }
      at = stop;
    } else {
      if (source[at] === "\n") line += 1;
      code += source[at];
      at += 1;
    }
  }
  return { code, comments };
}

const lineAt = (text: string, index: number) => text.slice(0, index).split("\n").length;

const labelFrom = (name: string) => {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** `"Label" min=1 value=#fff` as the label and the named values. */
function readAttributes(text: string) {
  const label = /"([^"]{1,60})"/.exec(text)?.[1];
  const attributes = new Map<string, string>();
  for (const [, key, value] of text.replace(/"[^"]*"/g, "").matchAll(/(\w+)=(\S+)/g)) {
    attributes.set(key!, value!);
  }
  return { label, attributes };
}

const hexColour = /^#[0-9a-f]{6}$/i;

function readControl(
  type: string,
  name: string,
  comment: string | undefined,
  line: number,
  problems: ShaderProblem[],
): ShaderControl | undefined {
  const annotation = comment && /@(slider|colou?r|toggle)\b(.*)/.exec(comment);
  const { label: written, attributes } = readAttributes(annotation ? (annotation[2] ?? "") : "");
  const label = written ?? labelFrom(name);
  const kind = annotation ? annotation[1]!.replace("color", "colour") : undefined;
  const fits = { slider: ["float", "int"], colour: ["vec3"], toggle: ["bool"] };
  if (kind && !fits[kind as keyof typeof fits].includes(type)) {
    problems.push({
      line,
      message: `Line ${line}: @${kind} doesn't fit “${name}”, which is a ${type}.`,
    });
    return undefined;
  }
  if (type === "float" || type === "int") {
    const number = (key: string, fallback: number) => {
      const value = attributes.has(key) ? Number(attributes.get(key)) : fallback;
      if (Number.isFinite(value)) return value;
      problems.push({ line, message: `Line ${line}: ${key} should be a number.` });
      return fallback;
    };
    const whole = type === "int";
    const min = number("min", 0);
    const max = number("max", whole ? 10 : 1);
    const step = number("step", whole ? 1 : (max - min) / 100);
    const value = number("value", whole ? Math.round((min + max) / 2) : (min + max) / 2);
    if (min >= max || step <= 0 || value < min || value > max) {
      problems.push({
        line,
        message: `Line ${line}: “${name}” should have min below max, a step above 0, and a value between them.`,
      });
      return undefined;
    }
    return { kind: "slider", name, label, min, max, step, value, whole };
  }
  if (type === "vec3") {
    const value = attributes.get("value") ?? "#808080";
    if (hexColour.test(value)) return { kind: "colour", name, label, value };
    problems.push({ line, message: `Line ${line}: a colour's value looks like #ff6a3d.` });
    return undefined;
  }
  if (type === "bool") {
    const value = attributes.get("value") ?? "off";
    return { kind: "toggle", name, label, value: value === "on" || value === "true" };
  }
  problems.push({
    line,
    message:
      type.startsWith("sampler") || type === "samplerCube"
        ? `Line ${line}: shaders can't load pictures of their own. Use below(uv) to read the layers under this one.`
        : `Line ${line}: “${name}” is a ${type}. A control can be a float, int, bool or vec3.`,
  });
  return undefined;
}

/** `#define NAME 8` and `const int NAME = 8;`: numbers a loop may use as its limit. */
function readConstants(code: string): Map<string, number> {
  const constants = new Map<string, number>();
  for (const [, name, value] of code.matchAll(/^[ \t]*#define\s+(\w+)\s+([\d.]+)[ \t]*$/gm)) {
    constants.set(name!, Number(value));
  }
  for (const [, name, value] of code.matchAll(/\bconst\s+(?:int|float)\s+(\w+)\s*=\s*([\d.]+)/g)) {
    constants.set(name!, Number(value));
  }
  return constants;
}

const loopHead =
  /^\(\s*(?:int|float)\s+(\w+)\s*=\s*([\w.]+)\s*;\s*(\w+)\s*(<=|<|>=|>|!=)\s*([\w.]+)\s*;\s*(?:(\+\+|--)\s*(\w+)|(\w+)\s*(\+\+|--|\+=\s*[\w.]+|-=\s*[\w.]+))\s*\)/;

/** How many times a `for (...)` repeats, or undefined when that isn't fixed in the code. */
function loopSteps(head: string, constants: ReadonlyMap<string, number>): number | undefined {
  const parts = loopHead.exec(head);
  if (!parts) return undefined;
  const value = (text: string | undefined) => {
    const known = text === undefined ? undefined : constants.get(text);
    return known ?? (text !== undefined && /^[\d.]+$/.test(text) ? Number(text) : undefined);
  };
  const start = value(parts[2]);
  const limit = value(parts[5]);
  const change = parts[6] ?? parts[9] ?? "";
  const by = /^[+-]=/.test(change.replace(/\s/g, "")) ? value(change.replace(/[+\-=\s]/g, "")) : 1;
  if (start === undefined || limit === undefined || !by || parts[1] !== parts[3]) return undefined;
  return Math.ceil(Math.abs(limit - start) / by) + (/=/.test(parts[4] ?? "") ? 1 : 0);
}

/** Where the bracket opened at `open` closes. */
function closingOf(code: string, open: number, opening: string, closing: string): number {
  let depth = 0;
  for (let at = open; at < code.length; at += 1) {
    if (code[at] === opening) depth += 1;
    else if (code[at] === closing && (depth -= 1) === 0) return at;
  }
  return code.length;
}

/** The most work one pixel can ask for, counting loops inside loops and calls inside loops. */
function measureWork(code: string, problems: ShaderProblem[]): number {
  const constants = readConstants(code);
  const functions = new Map<string, [number, number]>();
  for (const found of code.matchAll(/\b\w+\s+(\w+)\s*\([^;{}()]*\)\s*\{/g)) {
    if (["if", "for", "else"].includes(found[1]!)) continue;
    const open = found.index + found[0].length - 1;
    functions.set(found[1]!, [open + 1, closingOf(code, open, "{", "}")]);
  }
  const known = new Map<string, number>();
  const visiting = new Set<string>();
  const costOfFunction = (name: string): number => {
    const saved = known.get(name);
    if (saved !== undefined) return saved;
    if (visiting.has(name)) return 0;
    visiting.add(name);
    const [start, end] = functions.get(name)!;
    const cost = costOf(start, end);
    visiting.delete(name);
    known.set(name, cost);
    return cost;
  };
  const costOf = (start: number, end: number): number => {
    let cost = 0;
    const tokens = /\b(for|\w+)\s*\(/g;
    tokens.lastIndex = start;
    for (let found = tokens.exec(code); found && found.index < end; found = tokens.exec(code)) {
      if (found[1] !== "for") {
        if (functions.has(found[1]!)) cost += 1 + costOfFunction(found[1]!);
        continue;
      }
      const open = found.index + found[0].length - 1;
      const close = closingOf(code, open, "(", ")");
      const steps = loopSteps(code.slice(open, close + 1), constants);
      if (steps === undefined) {
        const line = lineAt(code, found.index);
        problems.push({
          line,
          message: `Line ${line}: a loop needs a fixed number of steps, like for (int i = 0; i < 32; i++).`,
        });
      }
      let body = close + 1;
      while (/\s/.test(code[body] ?? "")) body += 1;
      const bodyEnd =
        code[body] === "{" ? closingOf(code, body, "{", "}") : code.indexOf(";", body);
      cost += (steps ?? 1) * (1 + costOf(body, bodyEnd < 0 ? end : bodyEnd));
      tokens.lastIndex = bodyEnd < 0 ? end : bodyEnd;
    }
    return cost;
  };
  return functions.has("main") ? costOfFunction("main") : 0;
}

/** Everything wrong with the code that can be seen without a graphics card, and its controls. */
export function readCustomShader(source: string): ReadShader {
  const problems: ShaderProblem[] = [];
  const controls: ShaderControl[] = [];
  const bytes = new TextEncoder().encode(source).length;
  if (bytes > customShaderLimits.size) {
    return {
      code: "",
      controls,
      problems: [
        {
          line: 1,
          message: `This shader is ${Math.ceil(bytes / 1024)} KB. It can be at most ${customShaderLimits.size / 1024} KB.`,
        },
      ],
    };
  }
  const { code, comments } = splitComments(source.replace(/\r\n?/g, "\n"));
  const lines = code.split("\n");
  if (lines.length > customShaderLimits.lines) {
    return {
      code: "",
      controls,
      problems: [
        {
          line: customShaderLimits.lines + 1,
          message: `This shader has ${lines.length} lines. It can have at most ${customShaderLimits.lines}.`,
        },
      ],
    };
  }
  const report = (line: number, message: string) =>
    problems.push({ line, message: `Line ${line}: ${message}` });

  lines.forEach((text, index) => {
    const line = index + 1;
    const stranger = /[^\x20-\x7e\t]/.exec(text);
    if (stranger) report(line, `“${stranger[0]}” can't be used outside a comment.`);
    const directive = /^\s*#\s*(\w*)/.exec(text);
    if (directive && !(directive[1] === "define" && /^\s*#define\s+\w+\s+[\d.]+\s*$/.test(text))) {
      report(line, "the only # line allowed is a number, like #define STEPS 32.");
    }
    if (/\b(while|do|goto)\b/.test(text)) {
      report(line, "only for loops with a fixed number of steps can be used.");
    }
    if (/\b(texture2D\w*|textureCube\w*|lintel\w*|gl_FragData|webgl_\w*)\b/.test(text)) {
      report(line, "that name is reserved. Use below(uv) to read the layers under this one.");
    }
  });

  for (const found of code.matchAll(
    /\buniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+([^;]+);/g,
  )) {
    const line = lineAt(code, found.index);
    const names = found[2]!.split(",").map((name) => name.trim());
    for (const name of names) {
      if (provided.includes(name)) {
        report(line, `“${name}” is provided for you. Remove this line.`);
      } else if (!/^[A-Za-z]\w{0,39}$/.test(name) || name.startsWith("gl_")) {
        report(line, `“${name}” can't be a control's name. Use letters, numbers and _.`);
      } else {
        const control = readControl(
          found[1]!,
          name,
          names.length === 1 ? comments.get(line) : undefined,
          line,
          problems,
        );
        if (control) controls.push(control);
      }
    }
  }
  if (controls.length > customShaderLimits.controls) {
    problems.push({
      line: 1,
      message: `This shader has ${controls.length} controls. It can have at most ${customShaderLimits.controls}.`,
    });
  }
  for (const name of provided) {
    const declared = new RegExp(`\\b(?:float|vec[234]|int|bool)\\s+${name}\\s*[=;(,]`).exec(
      code.replace(/\buniform\s+[^;]+;/g, (uniform) => " ".repeat(uniform.length)),
    );
    if (declared && name !== "uv") {
      report(lineAt(code, declared.index), `“${name}” is provided for you. Use another name.`);
    }
  }
  if (!/\bvoid\s+main\s*\(\s*(void)?\s*\)\s*\{/.test(code)) {
    problems.push({
      line: 1,
      message: "Line 1: a shader needs a void main() that sets gl_FragColor.",
    });
  } else {
    const steps = measureWork(code, problems);
    if (steps > customShaderLimits.stepsPerPixel) {
      const line = lineAt(code, /\bvoid\s+main\b/.exec(code)!.index);
      problems.push({
        line,
        message: `Line ${line}: this repeats work about ${steps.toLocaleString("en-GB")} times for every pixel. It can do so at most ${customShaderLimits.stepsPerPixel.toLocaleString("en-GB")} times, or it would freeze phones.`,
      });
    }
  }
  const all = [...comments.values()].join("\n");
  const name = /@name\s+(.{1,60}?)\s*$/m.exec(all)?.[1];
  const fallback = /@fallback\s+(#[0-9a-f]{6})\b/i.exec(all)?.[1];
  problems.sort((first, second) => first.line - second.line);
  return { code, controls, name, fallback, problems };
}

/**
 * What goes in front of every custom shader: the values it can read. Its size matters, as
 * the compiler counts lines from here (see `explainCompilerLog`).
 */
export const customShaderOpening = `#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;
uniform float time,scroll;
uniform vec2 resolution,pointer;
uniform sampler2D lintelBelow;
uniform vec2 lintelBelowSize;
vec4 below(vec2 p){return texture2D(lintelBelow,p*lintelBelowSize);}
`;

const openingLines = customShaderOpening.split("\n").length - 1;

export const customShaderFragment = (code: string) => `${customShaderOpening}${code}`;

const plainWords: ReadonlyArray<[RegExp, (found: RegExpExecArray) => string]> = [
  [
    /'(\w+)' : undeclared identifier/,
    (found) => `“${found[1]}” isn't defined. Check its spelling, or declare it first.`,
  ],
  [
    /'(\w+)' : no matching overloaded function/,
    (found) =>
      `${found[1]}() doesn't take these values. Check how many you give it and their types.`,
  ],
  [
    /cannot convert from '([^']+)' to '([^']+)'/,
    (found) =>
      `this is a ${found[1]!.replace(/^const /, "")} where a ${found[2]!.replace(/^const /, "")} is needed. Whole numbers in shaders need a point: 1.0, not 1.`,
  ],
  [
    /wrong operand types.*'(\S+)'/,
    (found) =>
      `these two values can't be combined with ${found[1]}. Whole numbers in shaders need a point: 1.0, not 1.`,
  ],
  [
    /'(\S+)' : syntax error/,
    (found) => `there's a mistake near “${found[1]}”. A semicolon or bracket may be missing.`,
  ],
  [
    /unexpected end of file|syntax error/,
    () => "something is unfinished. A semicolon or bracket may be missing.",
  ],
  [/'(\w+)' : function already has a body|redefinition/, () => "this name is already used."],
];

/** What the compiler said, as plain sentences naming the line in what was typed. */
export function explainCompilerLog(log: string): ShaderProblem[] {
  const problems: ShaderProblem[] = [];
  for (const [, row, rest] of log.matchAll(/ERROR:\s*\d+:(\d+):\s*(.*)/g)) {
    const line = Math.max(1, Number(row) - openingLines);
    const plain = plainWords.flatMap(([pattern, say]) => {
      const found = pattern.exec(rest!);
      return found ? [say(found)] : [];
    })[0];
    problems.push({ line, message: `Line ${line}: ${plain ?? rest!.trim()}` });
  }
  if (problems.length === 0 && log.trim()) {
    problems.push({ line: 1, message: `Line 1: ${log.trim().slice(0, 160)}` });
  }
  return problems.slice(0, 6);
}

/** A short fingerprint of some code, to remember one that froze without keeping the code. */
export function shaderFingerprint(code: string): string {
  let hash = 2166136261;
  for (let at = 0; at < code.length; at += 1) {
    hash = Math.imul(hash ^ code.charCodeAt(at), 16777619);
  }
  return (hash >>> 0).toString(36);
}
