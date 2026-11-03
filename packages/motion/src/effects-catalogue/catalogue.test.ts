import { describe, expect, it } from "vitest";
import { effectModuleNames, type EffectModule } from "../effects/effect-types.js";
import { standardEffects } from "./catalogue/index.js";
import {
  cleanProps,
  defaultProps,
  defineEffect,
  effectCategories,
  InvalidEffectError,
} from "./effect-definition.js";
import { createEffectRegistry } from "./effect-registry.js";
import { measurePageWeight } from "./page-weight.js";
import { number, toggle } from "./parameters.js";
import { resolveNodeEffects } from "./resolve-effects.js";
import {
  defaultSiteEffectSettings,
  hasSiteEffects,
  introMarkup,
  pageTransitionCss,
  siteEffectSettingsSchema,
} from "./site-effects.js";

const loadedModules: Record<string, EffectModule> = Object.fromEntries(
  await Promise.all(
    effectModuleNames.map(
      async (name) =>
        [name, (await import(`../effects/modules/${name}.module.ts`)) as EffectModule] as const,
    ),
  ),
);

describe("the effects library", () => {
  it("has over a hundred effects with unique ids, in every category", () => {
    expect(standardEffects.length).toBeGreaterThanOrEqual(100);
    expect(new Set(standardEffects.map((effect) => effect.id)).size).toBe(standardEffects.length);
    for (const category of effectCategories) {
      expect(
        standardEffects.some((effect) => effect.category === category),
        category,
      ).toBe(true);
    }
  });

  it("runs every behaviour effect with a function its module really has", () => {
    for (const effect of standardEffects) {
      if (effect.kind !== "behaviour") continue;
      expect(effectModuleNames, effect.id).toContain(effect.module);
      expect(typeof loadedModules[effect.module]?.behaviours[effect.behaviour], effect.id).toBe(
        "function",
      );
    }
  });

  it("says what each effect does for people who ask for less motion", () => {
    for (const effect of standardEffects)
      expect(effect.reducedMotion.length, effect.id).toBeGreaterThan(5);
  });
});

describe("defineEffect", () => {
  it("keeps the settings' types and starting values", () => {
    const glow = defineEffect({
      id: "my-glow",
      name: "My glow",
      description: "A glow of my own.",
      category: "hover",
      kind: "behaviour",
      module: "custom",
      behaviour: "my-glow",
      suits: ["any"],
      params: { size: number("Size", 10, 0, 20), on: toggle("On", true) },
      reducedMotion: "Still.",
      preview: "card",
    });
    const props: { size: number; on: boolean } = defaultProps(glow.params);
    expect(props).toEqual({ size: 10, on: true });
  });

  it("refuses bad ids, starting values outside their range and broken animations", () => {
    const base = {
      name: "X",
      description: "X",
      category: "hover",
      suits: ["any"],
      reducedMotion: "Still.",
      preview: "card",
    } as const;
    expect(() =>
      defineEffect({ ...base, id: "Bad Id", kind: "style", params: {}, staticCss: () => "" }),
    ).toThrow(InvalidEffectError);
    expect(() =>
      defineEffect({
        ...base,
        id: "out-of-range",
        kind: "style",
        params: { size: number("Size", 50, 0, 20) },
        staticCss: () => "",
      }),
    ).toThrow(/outside its range/);
    expect(() =>
      defineEffect({
        ...base,
        id: "broken",
        kind: "animation",
        params: {},
        animation: () => ({ trigger: { type: "load" }, tracks: [] }),
      }),
    ).toThrow(InvalidEffectError);
  });

  it("cleans stored settings: clamps numbers, drops unknown names and unsafe text", () => {
    const effect = standardEffects.find((candidate) => candidate.id === "typewriter-phrases")!;
    const cleaned = cleanProps(effect, { speed: 99999, phrases: "<script>a</script>", extra: 1 });
    expect(cleaned.speed).toBe(200);
    expect(cleaned.phrases).toBe("scripta/script");
    expect(cleaned).not.toHaveProperty("extra");
  });
});

describe("turning saved effects into what the page runs", () => {
  const registry = createEffectRegistry();

  it("lists behaviours with their fixed settings and writes static CSS", () => {
    const resolved = resolveNodeEffects(
      [
        { nodeId: "a1", effects: [{ effect: "tilt-deep", params: { angle: 25 } }] },
        {
          nodeId: "b2",
          effects: [
            { effect: "liquid-ocean", params: {} },
            { effect: "no-such-effect", params: {} },
          ],
        },
      ],
      registry,
    );
    expect(resolved.bindings[0]).toEqual({
      nodeId: "a1",
      module: "pointer",
      behaviour: "tilt",
      params: { perspective: 500, lift: 1.06, angle: 25, glare: false },
    });
    expect(resolved.bindings).toHaveLength(2);
    expect(resolved.css).toContain('[data-node-id="b2"] { background: radial-gradient');
  });

  it("adds up each module once and warns about heavy combinations", () => {
    const find = (id: string) => registry.find(id)!;
    const light = measurePageWeight([
      find("magnetic-pull"),
      find("tilt-card"),
      find("scramble-in"),
    ]);
    expect(light.modules).toEqual(["pointer", "text"]);
    expect(light.bytes).toBeGreaterThan(1000);
    expect(light.warnings).toEqual([]);
    const heavy = measurePageWeight([
      find("liquid-gradient"),
      find("image-ripple-hover"),
      find("water-ripple"),
    ]);
    expect(heavy.warnings).toContain("severalShaderEffects");
  });

  it("offers only the effects that suit an element", () => {
    const forText = registry.suiting("text").map((effect) => effect.id);
    expect(forText).toContain("scramble-in");
    expect(forText).not.toContain("cylinder-gallery");
  });
});

describe("site-wide effects", () => {
  it("are all off by default and then write nothing", () => {
    expect(pageTransitionCss(defaultSiteEffectSettings)).toBe("");
    expect(introMarkup(defaultSiteEffectSettings, { skip: "Skip", loading: "Loading" })).toBe("");
  });

  it("write view transition CSS only for people happy with motion, and escape the intro's text", () => {
    const settings = {
      ...defaultSiteEffectSettings,
      pageTransition: { style: "slide" as const, duration: 400 },
      intro: { ...defaultSiteEffectSettings.intro, style: "name" as const, text: "<Acme>" },
    };
    expect(pageTransitionCss(settings)).toMatch(
      /^@media \(prefers-reduced-motion: no-preference\) \{\n@view-transition \{ navigation: auto; \}/,
    );
    expect(introMarkup(settings, { skip: "Skip intro", loading: "Loading" })).toContain(
      "&lt;Acme&gt;",
    );
  });
});

describe("smooth scrolling, the cursor's colour and the pointer fields", () => {
  it("starts with smooth scrolling off, and counts it as a site effect once it is on", () => {
    expect(defaultSiteEffectSettings.smoothScroll.strength).toBe("off");
    expect(defaultSiteEffectSettings.cursor.colour).toBe("text");
    const gentle = { ...defaultSiteEffectSettings, smoothScroll: { strength: "gentle" as const } };
    expect(hasSiteEffects(defaultSiteEffectSettings)).toBe(false);
    expect(hasSiteEffects(gentle)).toBe(true);
    expect(measurePageWeight([], gentle).modules).toEqual(["smooth-scroll"]);
  });

  it("reads settings saved before smooth scrolling existed, and keeps a hand-picked colour", () => {
    const older = siteEffectSettingsSchema.parse({
      cursor: { style: "dot", trail: "none", colour: "#ff0000", size: 24 },
    });
    expect(older.smoothScroll.strength).toBe("off");
    expect(older.cursor.colour).toBe("#ff0000");
    expect(siteEffectSettingsSchema.safeParse({ cursor: { colour: "red" } }).success).toBe(false);
    expect(siteEffectSettingsSchema.parse({ cursor: { colour: "brand" } }).cursor.colour).toBe(
      "brand",
    );
  });

  it("keeps the word on the cursor and the hover picture out of the gallery, but still runs them", () => {
    const registry = createEffectRegistry();
    const offered = registry.suiting("any").map((effect) => effect.id);
    expect(offered).not.toContain("cursor-word");
    expect(offered).not.toContain("hover-picture");
    const resolved = resolveNodeEffects(
      [
        {
          nodeId: "row",
          effects: [
            { effect: "hover-picture", params: { src: "/media/cake.jpg" } },
            { effect: "cursor-word", params: { text: "View" } },
          ],
        },
      ],
      registry,
    );
    expect(resolved.bindings.map((binding) => binding.behaviour)).toEqual([
      "hoverPicture",
      "cursorWord",
    ]);
    expect(resolved.bindings[0]?.params).toMatchObject({ src: "/media/cake.jpg", size: "medium" });
  });

  it("doesn't warn about two cursors when an element only has a word for the site cursor", () => {
    const word = registry().find("cursor-word");
    const site = {
      ...defaultSiteEffectSettings,
      cursor: { ...defaultSiteEffectSettings.cursor, style: "ring" as const },
    };
    expect(measurePageWeight(word ? [word] : [], site).warnings).not.toContain("cursorAndTrails");
  });
});

function registry() {
  return createEffectRegistry();
}
