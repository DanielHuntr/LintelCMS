import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { assignClassNames } from "../styles/class-names.js";
import { compileStylesheet } from "../styles/compile-stylesheet.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { applySharedStyles } from "./shared-styles.js";
import { siteDesignSchema } from "./site-design.js";
import {
  applyTagStyles,
  compileTagStyles,
  tagStylesEnd,
  tagStylesStart,
  withoutTagStyles,
} from "./tag-styles.js";

const startingStyles = (type: string) => standardCatalogue.find(type)?.defaultStyles;

describe("styles for every element of a kind", () => {
  it("compiles to rules no stronger than a tag, between markers", () => {
    const css = compileTagStyles({
      headings: { base: { fontFamily: "var(--lintel-var-display)" } },
      links: {
        base: { color: "var(--lintel-var-ink)" },
        hover: { textDecoration: "none" },
        phone: { fontSize: "1rem" },
      },
    });
    expect(css).toBe(
      [
        tagStylesStart,
        ":where(.lintel-design) :is(h1, h2, h3, h4, h5, h6) {",
        "  font-family: var(--lintel-var-display);",
        "}",
        ":where(.lintel-design) a:where(:not(.lintel-button, nav a, .lintel-site-logo)) {",
        "  color: var(--lintel-var-ink);",
        "}",
        ":where(.lintel-design) a:where(:not(.lintel-button, nav a, .lintel-site-logo)):hover {",
        "  text-decoration: none;",
        "}",
        "@media (max-width: 767px) {",
        "  :where(.lintel-design) a:where(:not(.lintel-button, nav a, .lintel-site-logo)) {",
        "    font-size: 1rem;",
        "  }",
        "}",
        tagStylesEnd,
        "",
      ].join("\n"),
    );
    expect(compileTagStyles({})).toBe("");
    expect(compileTagStyles(undefined)).toBe("");
  });

  it("is taken out of a stylesheet, so the builder can put the latest in", () => {
    const css = `a {}\n${compileTagStyles({ paragraphs: { base: { color: "red" } } })}b {}`;
    expect(withoutTagStyles(css)).toBe("a {}\n\nb {}");
    expect(withoutTagStyles("a {}")).toBe("a {}");
  });

  it("gives buttons the look in place of their starting styles, under what was changed", () => {
    const page = createNode(
      {
        type: "page",
        children: [
          { type: "button", name: "Plain" },
          { type: "button", name: "Changed", styles: { base: { fontWeight: "400" } } },
          { type: "button", name: "Shared" },
          { type: "heading", name: "Title" },
        ],
      },
      standardCatalogue,
      createCountingNodeIds(),
    );
    // "Changed" was added with the starting styles and then had its weight changed.
    const changedStart = page.children[0]!.styles;
    const root = {
      ...page,
      children: [
        page.children[0]!,
        {
          ...page.children[1]!,
          styles: { ...changedStart, base: { ...changedStart.base, fontWeight: "400" } },
        },
        { ...page.children[2]!, sharedStyle: "pill", styles: { base: {} } },
        page.children[3]!,
      ],
    };
    const look = {
      base: { backgroundColor: "var(--lintel-var-ink)", fontWeight: "700", borderRadius: "999px" },
    };
    const drawn = applyTagStyles(root, { buttons: look }, startingStyles);
    const [plain, changed, shared, title] = drawn.children;
    expect(plain?.styles.base).toMatchObject(look.base);
    expect(plain?.styles.base.paddingTop).toBe("var(--lintel-space-3)");
    expect(plain?.styles.hover).toEqual({ opacity: "0.88" });
    expect(changed?.styles.base).toMatchObject({
      backgroundColor: "var(--lintel-var-ink)",
      fontWeight: "400",
    });
    expect(shared).toBe(root.children[2]);
    expect(title).toBe(root.children[3]);

    // Shared styles still win once they're laid under the element.
    const withShared = applySharedStyles(drawn, {
      pill: { id: "pill", name: "Pill", styles: { base: { borderRadius: "4px" } } },
    });
    const css = compileStylesheet(withShared, assignClassNames(withShared, standardCatalogue));
    expect(css).toContain(".shared {\n  border-radius: 4px;\n}");
  });

  it("leaves pages as they were when there are none", () => {
    const page = createNode(
      { type: "page", children: [{ type: "button" }] },
      standardCatalogue,
      createCountingNodeIds(),
    );
    expect(applyTagStyles(page, undefined, startingStyles)).toBe(page);
    expect(applyTagStyles(page, { headings: { base: { color: "red" } } }, startingStyles)).toBe(
      page,
    );
  });

  it("is read from the saved design, and designs from before have none", () => {
    expect(siteDesignSchema.parse({})).toEqual({ variables: [], sharedStyles: [] });
    expect(
      siteDesignSchema.parse({ tagStyles: { links: { base: { color: "red" } } } }).tagStyles,
    ).toEqual({ links: { base: { color: "red" } } });
    expect(siteDesignSchema.safeParse({ tagStyles: { tables: { base: {} } } }).success).toBe(false);
    expect(
      siteDesignSchema.safeParse({ tagStyles: { links: { base: { color: "red;}" } } } }).success,
    ).toBe(false);
  });
});
