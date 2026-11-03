import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { pageDocumentSchema, type PageNode } from "../document/page-document.schema.js";
import { assignClassNames } from "../styles/class-names.js";
import { compileStylesheet } from "../styles/compile-stylesheet.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import {
  designVariablesStylesheet,
  isDesignVariableValue,
  newVariableId,
  variablesAsTokens,
  variableValue,
} from "./design-variables.js";
import {
  applySharedStyles,
  countSharedStyleUses,
  detachSharedStyle,
  giveSharedStyle,
  makeSharedStyle,
  type SharedStyle,
} from "./shared-styles.js";
import { siteDesignSchema } from "./site-design.js";

function cards(): PageNode {
  return createNode(
    {
      type: "page",
      children: [
        {
          type: "box",
          name: "First card",
          styles: {
            base: {
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              gridColumn: "2 / span 4",
              zIndex: "2",
            },
            hover: { scale: "1.02" },
          },
        },
        { type: "box", name: "Second card", styles: { base: { backgroundColor: "red" } } },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
}

describe("shared styles", () => {
  it("moves an element's look into a new shared style, keeping its place on it", () => {
    const first = cards().children[0]!;
    const { sharedStyle, node } = makeSharedStyle(first, "card", "Card");
    expect(sharedStyle).toEqual({
      id: "card",
      name: "Card",
      styles: {
        base: { backgroundColor: "#ffffff", borderRadius: "8px" },
        hover: { scale: "1.02" },
      },
    });
    expect(node.sharedStyle).toBe("card");
    expect(node.styles).toEqual({ base: { gridColumn: "2 / span 4", zIndex: "2" } });
  });

  it("draws every element that uses one with its look, under the element's own styles", () => {
    const page = cards();
    const made = makeSharedStyle(page.children[0]!, "card", "Card");
    const second = giveSharedStyle(page.children[1]!, "card");
    expect(second.styles).toEqual({ base: {} });
    const withOwn = { ...second, styles: { base: { borderRadius: "20px" } } };
    const root = { ...page, children: [made.node, withOwn] };
    const library = { card: made.sharedStyle };

    const drawn = applySharedStyles(root, library);
    expect(drawn.children[0]?.styles.base).toEqual({
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      gridColumn: "2 / span 4",
      zIndex: "2",
    });
    expect(drawn.children[1]?.styles.base).toEqual({
      backgroundColor: "#ffffff",
      borderRadius: "20px",
    });
    expect(drawn.children[1]?.styles.hover).toEqual({ scale: "1.02" });
    const css = compileStylesheet(drawn, assignClassNames(drawn, standardCatalogue));
    expect(css).toContain(
      ".second-card {\n  background-color: #ffffff;\n  border-radius: 20px;\n}",
    );

    // Changing the shared style changes both.
    const changed: SharedStyle = {
      ...made.sharedStyle,
      styles: { base: { backgroundColor: "#efe6d6" } },
    };
    const redrawn = applySharedStyles(root, { card: changed });
    expect(redrawn.children.map((child) => child.styles.base.backgroundColor)).toEqual([
      "#efe6d6",
      "#efe6d6",
    ]);
    expect(countSharedStyleUses(root).get("card")).toBe(2);
  });

  it("hands back pages without shared styles as they were", () => {
    const page = cards();
    expect(applySharedStyles(page, {})).toBe(page);
    expect(applySharedStyles(page, undefined)).toBe(page);
    const missing = { ...page, children: [{ ...page.children[0]!, sharedStyle: "gone" }] };
    expect(
      applySharedStyles(missing, { card: { id: "card", name: "Card", styles: { base: {} } } }),
    ).toBe(missing);
  });

  it("detaches an element, which keeps the look it had as its own", () => {
    const { sharedStyle, node } = makeSharedStyle(cards().children[0]!, "card", "Card");
    const detached = detachSharedStyle(
      { ...node, styles: { ...node.styles, base: { ...node.styles.base, borderRadius: "0" } } },
      sharedStyle,
    );
    expect(detached.sharedStyle).toBeUndefined();
    expect(detached.styles.base).toEqual({
      backgroundColor: "#ffffff",
      borderRadius: "0",
      gridColumn: "2 / span 4",
      zIndex: "2",
    });
    expect(detached.styles.hover).toEqual({ scale: "1.02" });
  });

  it("is kept on elements when a page is read", () => {
    const page = cards();
    const root = { ...page, id: "page", children: [{ ...page.children[0]!, sharedStyle: "card" }] };
    expect(pageDocumentSchema.parse({ version: 2, root }).root.children[0]?.sharedStyle).toBe(
      "card",
    );
    const bad = { ...root, children: [{ ...page.children[0]!, sharedStyle: "Not an id!" }] };
    expect(pageDocumentSchema.safeParse({ version: 2, root: bad }).success).toBe(false);
  });
});

describe("design variables", () => {
  const sand = { id: "sand", name: "Sand", kind: "colour" as const, value: "#efe6d6" };
  const gutter = {
    id: "gutter",
    name: "Wide gutter",
    kind: "size" as const,
    value: "clamp(1rem, 4vw, 3rem)",
  };

  it("become custom properties on the website and values styles can store", () => {
    expect(designVariablesStylesheet([sand, gutter])).toBe(
      ":root {\n  --lintel-var-sand: #efe6d6;\n  --lintel-var-gutter: clamp(1rem, 4vw, 3rem);\n}\n",
    );
    expect(designVariablesStylesheet([])).toBe("");
    expect(variableValue(sand)).toBe("var(--lintel-var-sand)");
    expect(variablesAsTokens([sand, gutter], "colour")).toEqual([
      { name: "lintel-var-sand", label: "Sand", fallback: "#efe6d6" },
    ]);
  });

  it("only hold values of their kind, and nothing that could break the stylesheet", () => {
    expect(isDesignVariableValue("colour", "#efe6d6")).toBe(true);
    expect(isDesignVariableValue("colour", "rgb(10 20 30 / 50%)")).toBe(true);
    expect(isDesignVariableValue("colour", "2rem")).toBe(false);
    expect(isDesignVariableValue("size", "2.5rem")).toBe(true);
    expect(isDesignVariableValue("size", "red")).toBe(false);
    expect(isDesignVariableValue("font", '"Fraunces", Georgia, serif')).toBe(true);
    expect(isDesignVariableValue("font", "x; } body { display: none")).toBe(false);
    expect(designVariablesStylesheet([{ ...sand, value: "#fff; color: red" }])).toBe("");
  });

  it("get ids from their names that never clash", () => {
    expect(newVariableId("Sand", [])).toBe("sand");
    expect(newVariableId("Sand", ["sand", "sand-2"])).toBe("sand-3");
    expect(newVariableId("2 columns", [])).toBe("v-2-columns");
    expect(newVariableId("!!!", [])).toBe("element");
  });
});

describe("a site's design", () => {
  it("is checked before it is saved", () => {
    expect(siteDesignSchema.parse({})).toEqual({ variables: [], sharedStyles: [] });
    expect(
      siteDesignSchema.safeParse({
        variables: [
          { id: "sand", name: "Sand", kind: "colour", value: "#efe6d6" },
          { id: "sand", name: "Sand again", kind: "colour", value: "#ffffff" },
        ],
      }).success,
    ).toBe(false);
    expect(
      siteDesignSchema.safeParse({
        sharedStyles: [{ id: "card", name: "Card", styles: { base: { colour: "red" } } }],
      }).success,
    ).toBe(false);
  });
});
