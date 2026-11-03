import { describe, expect, it } from "vitest";
import { creativeEffects } from "./catalogue/creative-effects.js";
import { cleanProps, defaultProps } from "./effect-definition.js";
import { effectRegistry } from "./effect-registry.js";
import { measurePageWeight } from "./page-weight.js";
import { resolveNodeEffects } from "./resolve-effects.js";

const find = (id: string) => {
  const effect = effectRegistry.find(id);
  if (!effect) throw new Error(`${id} is missing`);
  return effect;
};

describe("the creative pack", () => {
  it("offers the backgrounds for sections and the picture effects for pictures", () => {
    for (const id of [
      "moving-gradient",
      "soft-light",
      "floating-dust",
      "contour-lines",
      "film-grain",
    ]) {
      expect(find(id).suits, id).toContain("container");
    }
    for (const id of ["develop-reveal", "pixel-reveal", "colour-split-hover"]) {
      expect(find(id).suits, id).toEqual(["image"]);
    }
  });

  it("keeps to a few plain settings each", () => {
    // Players are set through their elements' own fields, so the gallery leaves them out.
    for (const effect of creativeEffects.filter(({ listed }) => listed !== false)) {
      const settings = Object.values(effect.params).filter(
        (parameter) => parameter.kind !== "colour",
      );
      expect(settings.length, effect.id).toBeLessThanOrEqual(3);
      expect(Object.keys(effect.params).length, effect.id).toBeLessThanOrEqual(5);
    }
  });

  it("keeps words readable by default on the backgrounds that cover a section", () => {
    expect(defaultProps(find("moving-gradient").params)).toMatchObject({ readable: true });
    expect(defaultProps(find("soft-light").params)).toMatchObject({ readable: true });
  });

  it("accepts the site's colours, the words' colour and hex colours, and nothing else", () => {
    const gradient = find("moving-gradient");
    expect(cleanProps(gradient, { one: "var(--lintel-color-brand)" }).one).toBe(
      "var(--lintel-color-brand)",
    );
    expect(cleanProps(gradient, { one: "var(--brand-sand)" }).one).toBe("var(--brand-sand)");
    expect(cleanProps(gradient, { one: "currentColor" }).one).toBe("currentColor");
    expect(cleanProps(gradient, { one: "#123abc" }).one).toBe("#123abc");
    for (const junk of ["red;}body{display:none", "var(--x);color:red", "url(x)", 4]) {
      expect(cleanProps(gradient, { one: junk }).one).toBe("#e8d5c0");
    }
  });

  it("follows the words' colour for dust and contour lines unless another is chosen", () => {
    expect(defaultProps(find("floating-dust").params).colour).toBe("currentColor");
    expect(defaultProps(find("contour-lines").params).colour).toBe("currentColor");
  });

  it("paints a still look in the stylesheet for the backgrounds that cover", () => {
    const { css, bindings } = resolveNodeEffects(
      [
        {
          nodeId: "hero",
          effects: [{ effect: "moving-gradient", params: { one: "var(--lintel-color-brand)" } }],
        },
        { nodeId: "pool", effects: [{ effect: "soft-light", params: {} }] },
      ],
      effectRegistry,
    );
    expect(css).toContain('[data-node-id="hero"]');
    expect(css).toContain("radial-gradient(60% 75% at 20% 25%, var(--lintel-color-brand)");
    expect(css).toContain("background-color: #dfe9e6");
    expect(bindings[0]).toMatchObject({
      module: "shader-backgrounds",
      behaviour: "shaderBackground",
      params: { look: "mesh", readable: true },
    });
    expect(bindings[1]?.params.look).toBe("light");
  });

  it("counts the shader effects towards the heavy-page warning, but not the grain", () => {
    const shaders = measurePageWeight([
      find("moving-gradient"),
      find("develop-reveal"),
      find("colour-split-hover"),
    ]);
    expect(shaders.warnings).toContain("severalShaderEffects");
    expect(shaders.modules).toEqual(["picture-effects", "shader-backgrounds"]);
    const grain = measurePageWeight([find("film-grain"), find("film-grain"), find("pixel-reveal")]);
    expect(grain.warnings).not.toContain("severalShaderEffects");
  });
});
