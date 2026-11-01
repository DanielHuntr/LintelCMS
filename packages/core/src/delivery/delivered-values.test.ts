import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { DeliveredAsset } from "../fieldtypes/image-assets.js";
import { collectListedIds, type DeliveredReferences } from "./delivered-references.js";
import { collectImageIds, deliverValues } from "./delivered-values.js";

const TERM_ID = "5d0c6f1e-2b7a-4c55-9a8e-1f2d3c4b5a60";
const ENTRY_ID = "9b1e4c2d-7f3a-4e6b-8c5d-2a1b0c9d8e7f";
const IMAGE_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const sections: FieldDefinition = {
  handle: "sections",
  label: "Sections",
  type: "blocks",
  required: false,
  helpText: "",
  options: {
    blockTypes: [
      {
        handle: "related",
        name: "Related",
        description: "",
        fields: [
          {
            handle: "image",
            label: "Image",
            type: "image",
            required: false,
            helpText: "",
            options: {},
          },
          {
            handle: "topics",
            label: "Topics",
            type: "terms",
            required: false,
            helpText: "",
            options: { taxonomy: "tags" },
          },
          {
            handle: "reading",
            label: "Further reading",
            type: "entries",
            required: false,
            helpText: "",
            options: { collections: [] },
          },
        ],
      },
    ],
  },
};

const data = {
  sections: [
    {
      id: "b1",
      type: "related",
      data: { image: IMAGE_ID, topics: [TERM_ID], reading: [ENTRY_ID] },
    },
  ],
};

describe("delivering values inside blocks", () => {
  it("finds images, terms and linked entries inside blocks to look up", () => {
    expect(collectImageIds([sections], [data])).toEqual([IMAGE_ID]);
    expect(collectListedIds([sections], [data], "terms")).toEqual([TERM_ID]);
    expect(collectListedIds([sections], [data], "entries")).toEqual([ENTRY_ID]);
  });

  it("expands them inside each block like top-level fields", () => {
    const asset: DeliveredAsset = {
      id: IMAGE_ID,
      url: "https://cms.example.com/media/x/file",
      alt: "A view",
      width: 800,
      height: 600,
      focalPoint: { x: 0.5, y: 0.5 },
    };
    const references: DeliveredReferences = {
      terms: new Map([
        [TERM_ID, { id: TERM_ID, title: "Recipes", slug: "recipes", taxonomy: "tags" }],
      ]),
      entries: new Map([
        [
          ENTRY_ID,
          {
            id: ENTRY_ID,
            title: "Bread",
            slug: "bread",
            url: "/blog/bread",
            collection: "posts",
            locale: "en",
          },
        ],
      ]),
    };

    const delivered = deliverValues([sections], data, new Map([[IMAGE_ID, asset]]), references);

    expect(delivered.sections).toEqual([
      {
        id: "b1",
        type: "related",
        data: {
          image: asset,
          topics: [{ id: TERM_ID, title: "Recipes", slug: "recipes", taxonomy: "tags" }],
          reading: [
            {
              id: ENTRY_ID,
              title: "Bread",
              slug: "bread",
              url: "/blog/bread",
              collection: "posts",
              locale: "en",
            },
          ],
        },
      },
    ]);
  });
});
