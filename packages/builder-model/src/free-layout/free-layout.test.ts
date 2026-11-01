import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { PageNode } from "../document/page-document.schema.js";
import { catalogueFontFaces, fontCatalogue, isCatalogueFontFile } from "../fonts/font-catalogue.js";
import { fontFamilyValue, fontPreloads, pageFontSchema } from "../fonts/page-fonts.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { freePlaceStyles } from "./free-layout.js";
import { restack } from "./z-order.js";

function siblings(zIndexes: Array<string | undefined>): PageNode[] {
  const ids = createCountingNodeIds();
  return zIndexes.map((zIndex) =>
    createNode(
      { type: "box", styles: { base: zIndex === undefined ? {} : { zIndex } } },
      standardCatalogue,
      ids,
    ),
  );
}

describe("stacking overlapping elements", () => {
  it("brings forward and sends back by one, numbering everything from 1", () => {
    const nodes = siblings([undefined, undefined, "5"]);
    const [first, second, third] = nodes.map((node) => node.id) as [string, string, string];
    expect(Object.fromEntries(restack(nodes, first, "forward") ?? [])).toEqual({
      [second]: "1",
      [first]: "2",
      [third]: "3",
    });
    expect(Object.fromEntries(restack(nodes, third, "back") ?? [])).toEqual({
      [third]: "1",
      [first]: "2",
      [second]: "3",
    });
    expect(restack(nodes, third, "front")).toBeNull();
    expect(restack(nodes, first, "backward")).toBeNull();
  });

  it("stores places as tidy percentages", () => {
    expect(freePlaceStyles({ left: 12.345, top: 7.04, width: 33.333 })).toEqual({
      left: "12.3%",
      top: "7%",
      width: "33.3%",
    });
  });
});

describe("the font catalogue", () => {
  it("has a file for every weight and style it lists", () => {
    const folder = fileURLToPath(new URL("../../fonts/", import.meta.url));
    expect(fontCatalogue.length).toBeGreaterThanOrEqual(20);
    for (const entry of fontCatalogue) {
      for (const face of catalogueFontFaces(entry)) {
        const file = face.src.split("/").at(-1) ?? "";
        expect(existsSync(`${folder}${file}`), file).toBe(true);
        expect(isCatalogueFontFile(file)).toBe(true);
      }
      expect(existsSync(`${folder}licences/${entry.id}.txt`), entry.id).toBe(true);
    }
    expect(isCatalogueFontFile("../secrets.woff2")).toBe(false);
  });

  it("checks page fonts and names a fallback", () => {
    const bebas = pageFontSchema.parse({ source: "catalogue", id: "bebas-neue" });
    expect(fontFamilyValue(bebas)).toBe("'Bebas Neue', Impact, 'Arial Narrow', sans-serif");
    expect(fontPreloads([bebas])).toEqual(["/_lintel/fonts/bebas-neue-latin-400-normal.woff2"]);
    expect(pageFontSchema.safeParse({ source: "catalogue", id: "comic-sans" }).success).toBe(false);
    const sneaky = pageFontSchema.safeParse({
      source: "upload",
      family: "X",
      files: [{ src: '/a.woff2") format("x' }],
    });
    expect(sneaky.success).toBe(false);
    expect(
      pageFontSchema.safeParse({ source: "upload", family: "X'; }", files: [{ src: "/a.woff2" }] })
        .success,
    ).toBe(false);
  });
});
