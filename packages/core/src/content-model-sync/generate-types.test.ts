import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { modelFromUnits } from "./content-model.schema.js";
import { resolveFromRepository } from "./content-model-config.js";
import { defaultContentModel } from "./default-content-model.js";
import { generateModelTypes } from "./generate-types.js";

const STARTER_TYPES = resolveFromRepository("starters/nextjs/lib/lintel.generated.ts");

describe("model types", () => {
  const types = generateModelTypes(defaultContentModel());

  it("describes each content type's delivered data, with required fields never null", () => {
    expect(types).toContain(`export interface PostData {
  /** Title */
  title: string;
  /** Excerpt. Shown in lists of posts and in link previews */
  excerpt: string | null;
  /** Featured image */
  featured_image: DeliveredImage | null;
  /** Body */
  body: DeliveredRichText | null;
  /** Categories */
  categories: DeliveredTerm[] | null;
  /** Tags */
  tags: DeliveredTerm[] | null;
}`);
  });

  it("types blocks by block type, so `type` tells them apart", () => {
    expect(types).toContain(
      "export type PageSectionsBlock = PageSectionsHeroBlock | PageSectionsTextBlock | PageSectionsImageBlock | PageSectionsCallToActionBlock | PageSectionsFaqBlock;",
    );
    expect(types).toContain('  type: "hero";');
    expect(types).toContain("  sections: PageSectionsBlock[] | null;");
  });

  it("maps collections, global sets, taxonomies and menus to their handles", () => {
    expect(types).toContain(
      "export interface CollectionData {\n  pages: PageData;\n  posts: PostData;\n}",
    );
    expect(types).toContain("  site_settings: SiteSettingsData;");
    expect(types).toContain('export type TaxonomyHandle = "categories" | "tags";');
    expect(types).toContain('export type MenuHandle = "main";');
  });

  it("gives choices as a union of their values, and never clashes names", () => {
    const model = modelFromUnits([
      {
        kind: "contentType",
        handle: "delivered_image",
        name: "Odd name",
        collections: [],
        fields: [
          {
            handle: "title",
            label: "Title",
            type: "text",
            required: true,
            helpText: "",
            options: {},
          },
          {
            handle: "size",
            label: "Size",
            type: "select",
            required: false,
            helpText: "",
            options: {
              choices: [
                { value: "s", label: "Small" },
                { value: "l", label: "Large" },
              ],
              multiple: true,
            },
          },
        ],
      },
      { kind: "globalSet", handle: "delivered_image", name: "Also odd", fields: [] },
    ]);

    const odd = generateModelTypes(model);

    expect(odd).toContain('  size: ("s" | "l")[] | null;');
    expect(odd).toContain("export interface DeliveredImageData {");
    expect(odd).toContain("export interface DeliveredImageGlobalSetData {");
    expect(odd).toContain("export interface CollectionData {}");
  });

  it("is what the Next.js starter uses, generated from the default content model", async () => {
    expect(await readFile(STARTER_TYPES, "utf8")).toBe(types);
  });
});
