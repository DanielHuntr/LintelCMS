import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { pageDocumentSchema, type PageNode } from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { assignClassNames } from "../styles/class-names.js";
import { compileStylesheet } from "../styles/compile-stylesheet.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import {
  clampGridPlace,
  gridPlaceStyles,
  impliedPlacedGridStyles,
  lastOf,
  readGridLine,
} from "./placed-grid.js";

function editorialPage(): PageNode {
  const ids = createCountingNodeIds();
  return createNode(
    {
      type: "page",
      children: [
        {
          type: "section",
          name: "Story",
          styles: { base: {} },
          placedGrid: { columns: 12, stackOnPhone: true },
          children: [
            {
              type: "image",
              name: "Photo",
              styles: { base: { gridColumn: "2 / span 5", gridRow: "1 / span 3" } },
            },
            {
              type: "heading",
              name: "Title",
              styles: {
                base: { gridColumn: "5 / span 6", gridRow: "2", zIndex: "2" },
                phone: { gridColumn: "1 / span 10" },
              },
            },
            { type: "text", name: "Caption" },
          ],
        },
      ],
    },
    standardCatalogue,
    ids,
  );
}

function problemsOf(root: PageNode) {
  const result = validatePageDocument(
    { version: 2, root: { ...root, id: "page" } },
    standardCatalogue,
  );
  return result.ok ? [] : result.problems;
}

describe("placed grids", () => {
  it("prints the grid, the places and the stacking on phones as plain CSS grid", () => {
    const root = editorialPage();
    const css = compileStylesheet(root, assignClassNames(root, standardCatalogue));
    expect(css).toContain(
      [
        ".story {",
        "  display: grid;",
        "  gap: var(--lintel-space-5);",
        "  grid-template-columns: repeat(12, minmax(0, 1fr));",
        "  grid-auto-rows: minmax(3rem, auto);",
      ].join("\n"),
    );
    expect(css).toContain(".photo {\n  grid-column: 2 / span 5;\n  grid-row: 1 / span 3;\n}");
    expect(css).toContain(".title {");
    expect(css).toContain("  z-index: 2;");
    // Not placed yet: the whole width.
    expect(css).toContain(".caption {\n  grid-column: 1 / -1;");
    const phone = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(phone).toContain(".photo {\n    grid-column: 1 / -1;\n    grid-row: auto;\n  }");
    // Placed by hand on phones too: that place wins over the stacking.
    expect(phone).toContain(".title {\n    grid-column: 1 / span 10;\n    grid-row: auto;\n  }");
  });

  it("leaves phones alone when stacking on phones is off", () => {
    const section: PageNode = { ...editorialPage().children[0]! };
    section.placedGrid = { columns: 8, stackOnPhone: false };
    const implied = impliedPlacedGridStyles(section, null);
    expect(implied.base?.gridTemplateColumns).toBe("repeat(8, minmax(0, 1fr))");
    expect(implied.phone).toBeUndefined();
    expect(impliedPlacedGridStyles(section.children[0]!, section).phone).toBeUndefined();
  });

  it("changes nothing for pages without one", () => {
    const ids = createCountingNodeIds();
    const plain = createNode(
      { type: "section", children: [{ type: "text" }] },
      standardCatalogue,
      ids,
    );
    expect(impliedPlacedGridStyles(plain, null)).toEqual({});
    expect(impliedPlacedGridStyles(plain.children[0]!, plain)).toEqual({});
  });

  it("is kept when a page is read and checked", () => {
    const root = editorialPage();
    const parsed = pageDocumentSchema.parse({ version: 2, root });
    expect(parsed.root.children[0]?.placedGrid).toEqual({ columns: 12, stackOnPhone: true });
    expect(
      pageDocumentSchema.safeParse({
        version: 2,
        root: { ...root, children: [{ ...root.children[0], placedGrid: { columns: 40 } }] },
      }).success,
    ).toBe(false);
  });

  it("is refused on elements that can't hold one, and alongside a free layout", () => {
    const root = editorialPage();
    const section = root.children[0]!;
    const both = { ...root, children: [{ ...section, freeLayout: { stackOnPhone: true } }] };
    expect(problemsOf(both)).toEqual([
      expect.objectContaining({ message: expect.stringContaining("not both") }),
    ]);
    const heading = section.children[1]!;
    const wrong = {
      ...root,
      children: [{ ...section, children: [{ ...heading, placedGrid: section.placedGrid }] }],
    };
    expect(problemsOf(wrong)).toEqual([
      expect.objectContaining({ message: expect.stringContaining("placed grid") }),
    ]);
  });
});

describe("grid places", () => {
  it("writes places as a start and a span", () => {
    expect(gridPlaceStyles({ column: 2, columnSpan: 5, row: 1, rowSpan: 2 })).toEqual({
      gridColumn: "2 / span 5",
      gridRow: "1 / span 2",
    });
    expect(gridPlaceStyles({ column: 8, columnSpan: 1, row: 3, rowSpan: 1 })).toEqual({
      gridColumn: "8",
      gridRow: "3",
    });
  });

  it("reads the usual ways of writing a place back", () => {
    expect(readGridLine("2 / span 5")).toEqual({ start: 2, span: 5 });
    expect(readGridLine("2 / 7")).toEqual({ start: 2, span: 5 });
    expect(readGridLine("4")).toEqual({ start: 4, span: 1 });
    expect(readGridLine("span 3 / 6")).toEqual({ start: 3, span: 3 });
    expect(lastOf({ start: 2, span: 5 })).toBe(6);
    for (const unreadable of [undefined, "auto", "1 / -1", "photo", "span 2", "3 / 2"]) {
      expect(readGridLine(unreadable)).toBeUndefined();
    }
  });

  it("keeps places on the grid", () => {
    expect(clampGridPlace({ column: 10, columnSpan: 5, row: 0, rowSpan: 0 }, 12)).toEqual({
      column: 8,
      columnSpan: 5,
      row: 1,
      rowSpan: 1,
    });
    expect(clampGridPlace({ column: 1, columnSpan: 30, row: 2, rowSpan: 2 }, 12)).toEqual({
      column: 1,
      columnSpan: 12,
      row: 2,
      rowSpan: 2,
    });
  });
});
