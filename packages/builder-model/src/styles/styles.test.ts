import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createEmptyPage, type PageNode } from "../document/page-document.schema.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { assignClassNames, slugifyClassName } from "./class-names.js";
import { compileStylesheet, formatRule } from "./compile-stylesheet.js";
import { overriddenProperties, resolveStyle, setStyle } from "./style-cascade.js";
import { isSafeStyleValue } from "./style-properties.js";

describe("the style cascade", () => {
  const styles = {
    base: { fontSize: "2rem", color: "red" },
    tablet: { fontSize: "1.5rem" },
    hover: { color: "blue" },
  };

  it("takes each screen size’s value, or the next bigger one’s", () => {
    expect(resolveStyle(styles, "phone", "fontSize")).toEqual({ value: "1.5rem", setAt: "tablet" });
    expect(resolveStyle(styles, "tablet", "color")).toEqual({ value: "red", setAt: "base" });
    expect(resolveStyle(styles, "hover", "color")).toEqual({ value: "blue", setAt: "hover" });
    expect(resolveStyle(styles, "phone", "gap")).toEqual({ value: undefined, setAt: undefined });
  });

  it("drops a breakpoint once its last value is cleared", () => {
    const cleared = setStyle(styles, "tablet", "fontSize", undefined);
    expect(cleared).toEqual({ base: styles.base, hover: styles.hover });
    expect(overriddenProperties(styles, "tablet")).toEqual(["fontSize"]);
  });

  it("only allows plain values", () => {
    expect(isSafeStyleValue("repeat(3, minmax(0, 1fr))")).toBe(true);
    expect(isSafeStyleValue("var(--lintel-space-4)")).toBe(true);
    expect(isSafeStyleValue('"Helvetica Neue", sans-serif')).toBe(true);
    expect(isSafeStyleValue("red}body{display:none")).toBe(false);
    expect(isSafeStyleValue("url(https://example.com/x.png)")).toBe(false);
    expect(isSafeStyleValue("1px /* hi */")).toBe(false);
  });
});

describe("class names", () => {
  it("are readable and numbered in page order when they repeat", () => {
    const root: PageNode = {
      ...createEmptyPage().root,
      children: [
        createNode(
          { type: "section", name: "Hero", children: [{ type: "heading" }, { type: "heading" }] },
          standardCatalogue,
          createCountingNodeIds(),
        ),
        createNode(
          { type: "section", name: "Hero" },
          standardCatalogue,
          createCountingNodeIds("x"),
        ),
      ],
    };
    expect([...assignClassNames(root, standardCatalogue).values()]).toEqual([
      "page",
      "hero",
      "heading",
      "heading-2",
      "hero-2",
    ]);
    expect(slugifyClassName("Café menu – 2025!")).toBe("cafe-menu-2025");
    expect(slugifyClassName("3 columns")).toBe("el-3-columns");
    expect(slugifyClassName("✨")).toBe("element");
  });

  // LINTEL-FUNC-022: a layer named "Heading 2" and the second unnamed heading shared a class.
  it("never gives two elements the same class, whatever the layers are called", () => {
    const createId = createCountingNodeIds();
    const heading = (name = "") => ({
      ...createNode({ type: "heading" }, standardCatalogue, createId),
      name,
    });
    const root: PageNode = {
      ...createEmptyPage().root,
      children: [heading("Heading 2"), heading(), heading(), heading("Heading 3"), heading()],
    };
    const names = [...assignClassNames(root, standardCatalogue).values()];
    expect(names).toEqual([
      "page",
      "heading-2",
      "heading",
      "heading-3",
      "heading-3-2",
      "heading-4",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("brand-coloured text", () => {
  const brand = "var(--lintel-color-brand)";

  it("takes the theme's readable tone of the brand", () => {
    expect(formatRule(".label", { color: brand })).toContain(
      "  color: var(--lintel-color-brand-text, var(--lintel-color-brand));",
    );
  });

  it("is left alone with a background of its own", () => {
    const css = formatRule(".button", {
      color: brand,
      backgroundColor: "var(--lintel-color-on-brand)",
    });
    expect(css).toContain("  color: var(--lintel-color-brand);");
  });

  it("changes no other colour", () => {
    expect(formatRule(".a", { color: "var(--lintel-color-text)" })).toContain(
      "  color: var(--lintel-color-text);",
    );
    expect(formatRule(".a", { backgroundColor: brand })).toContain(
      "  background-color: var(--lintel-color-brand);",
    );
  });
});

describe("the stylesheet", () => {
  it("prints rules, states and breakpoints in a fixed order, leaving hidden nodes out", () => {
    const createId = createCountingNodeIds();
    const section = createNode(
      {
        type: "section",
        name: "Hero",
        children: [
          {
            type: "heading",
            name: "Hero title",
            styles: {
              base: { color: "var(--lintel-color-brand)", fontSize: "3rem" },
              phone: { fontSize: "2rem" },
            },
          },
          { type: "button" },
        ],
      },
      standardCatalogue,
      createId,
    );
    const hidden = {
      ...createNode(
        { type: "text", styles: { base: { color: "red" } } },
        standardCatalogue,
        createId,
      ),
      hidden: true,
    };
    const code = createNode(
      { type: "codeBlock", props: { css: ".custom { gap: 1rem; }" } },
      standardCatalogue,
      createId,
    );
    const root: PageNode = { ...createEmptyPage().root, children: [section, hidden, code] };
    const css = compileStylesheet(root, assignClassNames(root, standardCatalogue));
    expect(css).toMatchSnapshot();
    expect(compileStylesheet(root, assignClassNames(root, standardCatalogue))).toBe(css);
    expect(css).not.toContain("color: red");
  });
});
