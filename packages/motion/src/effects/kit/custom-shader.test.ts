import { describe, expect, it } from "vitest";
import {
  customShaderFragment,
  customShaderLimits,
  explainCompilerLog,
  readCustomShader,
  shaderFingerprint,
} from "./custom-shader.js";

const shader = (body: string) => `${body}\nvoid main(){gl_FragColor=vec4(uv,0.,1.);}`;
const messages = (source: string) => readCustomShader(source).problems.map((p) => p.message);

describe("controls from comments", () => {
  it("turns declared uniforms into sliders, colours and toggles", () => {
    const read = readCustomShader(
      shader(`// @name Soft rings
// @fallback #101820
uniform float rings; // @slider "How many rings" min=1 max=20 step=1 value=8
uniform int steps; // @slider "Steps" min=1 max=5 value=2
uniform vec3 tint; // @colour "Ring colour" value=#ff6a3d
uniform bool flip; // @toggle "Turn inside out" value=on`),
    );
    expect(read.problems).toEqual([]);
    expect(read.name).toBe("Soft rings");
    expect(read.fallback).toBe("#101820");
    expect(read.controls).toEqual([
      {
        kind: "slider",
        name: "rings",
        label: "How many rings",
        min: 1,
        max: 20,
        step: 1,
        value: 8,
        whole: false,
      },
      {
        kind: "slider",
        name: "steps",
        label: "Steps",
        min: 1,
        max: 5,
        step: 1,
        value: 2,
        whole: true,
      },
      { kind: "colour", name: "tint", label: "Ring colour", value: "#ff6a3d" },
      { kind: "toggle", name: "flip", label: "Turn inside out", value: true },
    ]);
  });

  it("gives a uniform with no comment a plain control, labelled from its name", () => {
    const { controls } = readCustomShader(
      shader("uniform float waveHeight;\nuniform vec3 glow_tint;"),
    );
    expect(controls[0]).toMatchObject({ kind: "slider", label: "Wave height", min: 0, max: 1 });
    expect(controls[1]).toMatchObject({ kind: "colour", label: "Glow tint" });
  });

  it("says plainly when a control can't work, naming the line", () => {
    expect(messages(shader(`\nuniform vec2 offset;`))[0]).toContain("Line 2: “offset” is a vec2");
    expect(messages(shader(`uniform vec3 tint; // @slider "No"`))[0]).toContain(
      "Line 1: @slider doesn't fit “tint”",
    );
    expect(messages(shader(`uniform float a; // @slider min=5 max=1`))[0]).toContain("Line 1:");
    expect(messages(shader(`uniform vec3 a; // @colour value=red`))[0]).toContain("#ff6a3d");
    const many = Array.from({ length: 13 }, (_, at) => `uniform float a${at};`).join("\n");
    expect(messages(shader(many))[0]).toContain("at most 12");
  });
});

describe("what the code may do", () => {
  it("bounds its size and length", () => {
    const large = shader(`float a=1.;${" ".repeat(customShaderLimits.size)}`);
    expect(messages(large)[0]).toContain("at most 16 KB");
    const long = shader("\n".repeat(customShaderLimits.lines + 1));
    expect(messages(long)[0]).toContain("at most 800");
  });

  it("refuses loops without a fixed end, and everything but plain numbers after #", () => {
    expect(messages("void main(){while(true){}}")[0]).toContain("only for loops");
    expect(messages("void main(){int i=0;do{i++;}while(i<3);}")[0]).toContain("only for loops");
    expect(messages("#extension GL_EXT_shader_texture_lod : enable\nvoid main(){}")[0]).toContain(
      "the only # line",
    );
    expect(messages("#define F(x) x\nvoid main(){}")[0]).toContain("the only # line");
    expect(messages("void main(){float n=3.;for(float i=0.;i<n;i++){}}")[0]).toContain(
      "fixed number of steps",
    );
  });

  it("counts work through loops inside loops and calls inside loops", () => {
    const heavy = `#define N 100
float inner(){float v=0.;for(int i=0;i<N;i++){v+=1.;}return v;}
void main(){float v=0.;for(int i=0;i<100;i++){v+=inner();}gl_FragColor=vec4(v);}`;
    expect(messages(heavy)[0]).toMatch(/Line 3: this repeats work about 10,\d{3} times/);
    const nested = `void main(){for(int i=0;i<100;i++)for(int j=0;j<100;j++){gl_FragColor=vec4(1.);}}`;
    expect(messages(nested)[0]).toContain("repeats work");
    const fine = `const int STEPS=64;float m(){return 1.;}
void main(){float v=0.;for(int i=0;i<STEPS;i++){v+=m();}gl_FragColor=vec4(v);}`;
    expect(messages(fine)).toEqual([]);
  });

  describe("can't be talked out of counting", () => {
    const refused = (code: string) => readCustomShader(code).problems.map(({ message }) => message);
    const body = "for (int i = 0; i < N; i++) { x += 1.0; }";
    const shader = (top: string, loop = body) =>
      `${top}
void main(){float x=0.;${loop}gl_FragColor=vec4(x);}`;

    it("doesn't read a number from the start of a constant it can't work out", () => {
      expect(refused(shader("const int N = 0x7fffffff;"))[0]).toContain("fixed number of steps");
      expect(refused(shader("const int N = 1000 * 1000;"))[0]).toContain("fixed number of steps");
    });

    it("takes the largest when a name is given more than one value", () => {
      const code = shader("const int N = 100000;\nfloat a(){const int N = 1;return 0.;}");
      expect(refused(code)[0]).toContain("times for every pixel");
    });

    it("counts the dearest of functions that share a name", () => {
      const code = `float a(int v){float x=0.;for(int i=0;i<9000;i++){x+=1.;}return x;}
float a(float v){return v;}
void main(){gl_FragColor=vec4(a(1.));}`;
      expect(refused(code)[0]).toContain("times for every pixel");
    });

    it("refuses a loop that runs away from its end", () => {
      for (const loop of [
        "for (int i = 0; i < 10; i--) { x += 1.0; }",
        "for (int i = 10; i > 0; i++) { x += 1.0; }",
        "for (int i = 0; i < 10; i -= 1) { x += 1.0; }",
      ]) {
        expect(refused(shader("", loop))[0]).toContain("fixed number of steps");
      }
    });

    it("refuses a loop that can step past its end", () => {
      const loop = "for (int i = 0; i != 10; i += 3) { x += 1.0; }";
      expect(refused(shader("", loop))[0]).toContain("fixed number of steps");
    });

    it("still takes a loop that counts down", () => {
      const loop = "for (int i = 10; i > 0; i--) { x += 1.0; }";
      expect(refused(shader("", loop))).toEqual([]);
    });
  });

  it("keeps a shader to what Lintel provides", () => {
    expect(messages(shader("uniform sampler2D photo;"))[0]).toContain("can't load pictures");
    expect(messages(shader("uniform float time;"))[0]).toContain("provided for you");
    expect(messages("void main(){float time=1.;gl_FragColor=vec4(time);}")[0]).toContain(
      "provided for you",
    );
    expect(messages("void main(){gl_FragColor=texture2D(lintelBelow,uv);}")[0]).toContain(
      "reserved",
    );
    expect(messages("float a;")[0]).toContain("needs a void main()");
  });

  it("takes comments out but keeps every line where it was, and allows any words in them", () => {
    const read = readCustomShader("// Größe ✓\n/* two\nlines */\nvoid main(){}");
    expect(read.problems).toEqual([]);
    expect(read.code.split("\n")).toHaveLength(4);
    expect(read.code).not.toMatch(/Größe|two/);
    expect(messages("void main(){float é=1.;}")[0]).toContain("Line 1: “é”");
  });

  it("treats script as nothing more than code that doesn't compile", () => {
    const read = readCustomShader(`</script><script>alert(1)</script>\nvoid main(){}`);
    expect(read.controls).toEqual([]);
    expect(customShaderFragment(read.code)).toContain("alert(1)");
  });
});

describe("compiler messages", () => {
  const firstLine = customShaderFragment("").split("\n").length;

  it("names the line as typed, in plain words", () => {
    const log = `ERROR: 0:${firstLine + 2}: 'sparkle' : undeclared identifier\nERROR: 0:${firstLine}: 'assign' : cannot convert from 'const int' to 'highp float'\n`;
    const [one, two] = explainCompilerLog(log);
    expect(one).toEqual({
      line: 3,
      message: "Line 3: “sparkle” isn't defined. Check its spelling, or declare it first.",
    });
    expect(two?.message).toContain("Line 1: this is a int where a highp float is needed");
  });

  it("passes on anything it doesn't recognise, and never more than six", () => {
    expect(explainCompilerLog("ERROR: 0:99: odd thing")[0]?.message).toContain("odd thing");
    const many = Array.from({ length: 9 }, () => `ERROR: 0:20: 'x' : syntax error`).join("\n");
    expect(explainCompilerLog(many)).toHaveLength(6);
  });
});

describe("fingerprints", () => {
  it("tells code apart without keeping it", () => {
    expect(shaderFingerprint("a")).not.toBe(shaderFingerprint("b"));
    expect(shaderFingerprint("a")).toBe(shaderFingerprint("a"));
  });
});
