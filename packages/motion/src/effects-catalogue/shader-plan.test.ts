import { describe, expect, it } from "vitest";
import { readCustomShader } from "../effects/kit/custom-shader.js";
import { cleanProps, defaultProps } from "./effect-definition.js";
import { effectRegistry } from "./effect-registry.js";
import { nodeEffectsSchema, type NodeEffect, type ShaderLayer } from "./node-effect.schema.js";
import { measurePageWeight } from "./page-weight.js";
import { resolveNodeEffects } from "./resolve-effects.js";
import {
  customShaderDefinition,
  customShaderEffectId,
  effectPlan,
  layeredBackgroundEffectId,
  layerFromEffect,
  shaderIdsInPlan,
} from "./shader-plan.js";

const layer = (effect: string, extra: Partial<ShaderLayer> = {}): ShaderLayer => ({
  id: effect,
  effect,
  params: {},
  blend: "normal",
  opacity: 1,
  ...extra,
});
const resolve = (effects: NodeEffect[]) =>
  resolveNodeEffects([{ nodeId: "hero", effects }], effectRegistry);
const planOf = (effect: NodeEffect) => JSON.parse(effectPlan(effect, effectRegistry) ?? "null");

describe("older effects", () => {
  it("run on their own module, with the same settings and new ones at values that change nothing", () => {
    const { bindings } = resolve([
      { effect: "moving-gradient", params: { one: "#112233", strength: 0.7 } },
    ]);
    expect(bindings[0]).toMatchObject({
      module: "shader-backgrounds",
      behaviour: "shaderBackground",
      params: {
        look: "mesh",
        one: "#112233",
        strength: 0.7,
        three: "",
        scale: 1,
        direction: 0,
        softness: 0.5,
      },
    });
  });

  it("still parse as saved, without layers or reactions", () => {
    expect(nodeEffectsSchema.parse([{ effect: "film-grain" }])).toEqual([
      { effect: "film-grain", params: {} },
    ]);
  });

  it("keep the main settings first and fold the rest", () => {
    const definition = effectRegistry.find("moving-gradient")!;
    const main = Object.entries(definition.params).filter(([, parameter]) => !parameter.more);
    expect(main.map(([name]) => name)).toEqual(["one", "two", "speed", "strength", "readable"]);
    expect(defaultProps(definition.params)).toMatchObject({ scale: 1, three: "" });
  });
});

describe("the stack", () => {
  it("runs one look on the stack once a setting reacts to something", () => {
    const { bindings } = resolve([
      {
        effect: "moving-gradient",
        params: {},
        reacts: { strength: { source: "scroll", to: 9 }, one: { source: "pointerX", to: 1 } },
      },
    ]);
    expect(bindings[0]).toMatchObject({ module: "shader-stack", behaviour: "shaderStack" });
    const plan = JSON.parse(String(bindings[0]!.params.plan));
    expect(plan.layers[0].look).toBe("mesh");
    // Kept in the setting's range, and only for number settings.
    expect(plan.layers[0].reacts).toEqual({ strength: { source: "scroll", to: 1 } });
  });

  it("always runs the new looks on the stack, with a still version in the stylesheet", () => {
    for (const id of ["glass", "halftone", "dithering", "aurora", "silk", "soft-cells"]) {
      const { bindings, css } = resolve([{ effect: id, params: {} }]);
      expect(bindings[0]?.module).toBe("shader-stack");
      expect(css, id).toContain("background");
      expect(effectRegistry.find(id)?.reducedMotion).toBeTruthy();
    }
  });

  it("draws layers from the bottom up, leaves hidden ones out and keeps blends", () => {
    const plan = planOf({
      effect: layeredBackgroundEffectId,
      params: { readable: false },
      layers: [
        layer("moving-gradient"),
        layer("soft-light", { hidden: true }),
        layer("film-grain", { blend: "overlay", opacity: 0.5 }),
      ],
    });
    expect(plan.readable).toBe(false);
    expect(plan.layers.map((entry: { look: string }) => entry.look)).toEqual(["mesh", "grain"]);
    expect(plan.layers[1]).toMatchObject({ blend: "overlay", opacity: 0.5 });
  });

  it("uses the lowest visible layer's still version, and counts every layer's weight", () => {
    const { css, used } = resolve([
      {
        effect: layeredBackgroundEffectId,
        params: {},
        layers: [layer("soft-light", { hidden: true }), layer("moving-gradient"), layer("glass")],
      },
    ]);
    expect(css).toContain("radial-gradient(60% 75%");
    const weight = measurePageWeight(used);
    expect(weight.modules).toContain("shader-stack");
    expect(weight.warnings).toContain("severalShaderEffects");
  });

  it("carries a custom layer by name, with colours checked, and its code only when asked", () => {
    const saved: NodeEffect = {
      effect: layeredBackgroundEffectId,
      params: {},
      layers: [
        layer(customShaderEffectId, {
          shader: "rings",
          params: { amount: 3, tint: "#123456", sneaky: "url(evil)", fallback: "#101820" },
        }),
      ],
    };
    const plan = effectPlan(saved, effectRegistry)!;
    expect(JSON.parse(plan).layers[0].values).toEqual({
      amount: 3,
      tint: "#123456",
      fallback: "#101820",
    });
    expect(shaderIdsInPlan({ plan })).toEqual(["rings"]);
    expect(plan).not.toContain("code");
    const withCode = effectPlan(saved, effectRegistry, { codeOf: () => "void main(){}" })!;
    expect(JSON.parse(withCode).layers[0].code).toBe("void main(){}");
    expect(resolve([saved]).css).toContain("background-color: #101820");
  });

  it("won't write a custom layer's plain background into the stylesheet unless it is a colour", () => {
    const { css } = resolve([
      {
        effect: layeredBackgroundEffectId,
        params: {},
        layers: [
          layer(customShaderEffectId, {
            shader: "a",
            params: { fallback: "red;}body{display:none" },
          }),
        ],
      },
    ]);
    expect(css).not.toContain("display");
  });

  it("bounds what can be saved", () => {
    const six = Array.from({ length: 7 }, () => layer("glass"));
    expect(
      nodeEffectsSchema.safeParse([{ effect: "layered-background", layers: six }]).success,
    ).toBe(false);
    expect(
      nodeEffectsSchema.safeParse([
        { effect: "layered-background", layers: [{ ...layer("glass"), blend: "plus-darker" }] },
      ]).success,
    ).toBe(false);
  });

  it("turns an effect into a layer without losing its settings", () => {
    const reacts = { strength: { source: "timeline" as const, to: 1, seconds: 4 } };
    expect(layerFromEffect({ effect: "aurora", params: { strength: 0.2 }, reacts }, "a")).toEqual({
      id: "a",
      effect: "aurora",
      params: { strength: 0.2 },
      blend: "normal",
      opacity: 1,
      reacts,
    });
  });
});

describe("a shader's controls as settings", () => {
  it("edits like any other effect", () => {
    const definition = customShaderDefinition(
      "Rings",
      readCustomShader(`uniform float a; // @slider "Amount" min=2 max=4 value=3
uniform vec3 b; // @colour value=#123456
uniform bool c; // @toggle value=on
// @fallback #101820
void main(){gl_FragColor=vec4(1.);}`),
    );
    expect(cleanProps(definition, { a: 9 })).toMatchObject({
      a: 4,
      b: "#123456",
      c: true,
      speed: 1,
      fallback: "#101820",
    });
    expect(definition.params.speed?.more).toBe(true);
  });
});
