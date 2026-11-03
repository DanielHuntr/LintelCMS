import { describe, expect, it } from "vitest";
import type { PageNode } from "../document/page-document.schema.js";
import { standardCatalogue } from "./component-catalogue.js";
import {
  impliedAnimationEffect,
  lottieAnimationComponent,
  pathTextGeometry,
  riveAnimationComponent,
  stickerPlaygroundComponent,
} from "./creative-components.js";

const node = (type: string, props: Record<string, unknown> = {}): PageNode => ({
  id: "n1",
  type,
  name: "",
  props,
  styles: { base: {} },
  hidden: false,
  locked: false,
  children: [],
});

describe("the creative pack's elements", () => {
  it("are in the Insert panel's catalogue", () => {
    for (const type of ["pathText", "lottieAnimation", "riveAnimation", "stickerPlayground"]) {
      expect(standardCatalogue.find(type)?.type, type).toBe(type);
    }
  });

  it("play Lintel's samples until a file is chosen, and refuse unsafe addresses", () => {
    expect(lottieAnimationComponent.propsSchema.parse({}).src).toBe("");
    expect(lottieAnimationComponent.propsSchema.parse({ src: "/media/hop.lottie" }).src).toBe(
      "/media/hop.lottie",
    );
    expect(() =>
      riveAnimationComponent.propsSchema.parse({ src: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      riveAnimationComponent.propsSchema.parse({ src: "//elsewhere.test/a.riv" }),
    ).toThrow();
  });

  it("hand the Lottie and Rive players their settings as an effect", () => {
    expect(
      impliedAnimationEffect(
        node("lottieAnimation", { src: "/a.json", play: "scroll", loop: false }),
      ),
    ).toEqual({
      effect: "lottie-player",
      params: { src: "/a.json", play: "scroll", loop: false },
    });
    expect(
      impliedAnimationEffect(node("riveAnimation", { respondTo: "click", input: "Pressed" })),
    ).toEqual({
      effect: "rive-player",
      params: { src: "", play: "view", respondTo: "click", input: "Pressed", stateMachine: "" },
    });
    expect(impliedAnimationEffect(node("heading"))).toBeUndefined();
    expect(impliedAnimationEffect({ ...node("lottieAnimation"), hidden: true })).toBeUndefined();
  });

  it("start the sticker playground with things to throw and the drag effect", () => {
    expect(stickerPlaygroundComponent.defaultEffects).toEqual([
      { effect: "drag-playground", params: {} },
    ]);
    expect(stickerPlaygroundComponent.defaultChildren?.length).toBeGreaterThanOrEqual(4);
  });

  it("draw a circle badge's words around a circle that fits its box", () => {
    const circle = pathTextGeometry("circle");
    expect(circle).toMatchObject({ width: 10, height: 10 });
    expect(circle.length).toBeCloseTo(23.56, 1);
    expect(pathTextGeometry("arc").path).toMatch(/^M /);
    expect(pathTextGeometry("wave").width).toBeGreaterThan(pathTextGeometry("wave").height);
  });
});
