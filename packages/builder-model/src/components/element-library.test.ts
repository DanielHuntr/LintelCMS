import { describe, expect, it } from "vitest";
import {
  bindProps,
  findNodesOfType,
  formatMoney,
  productAsItem,
  type ShopProduct,
} from "../data/bound-items.js";
import { createEmptyPage } from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { standardCatalogue, standardComponents } from "./component-catalogue.js";
import { componentCategories } from "./component-definition.js";
import { embedAllowedHosts } from "./media-components.js";

const createId = createCountingNodeIds("t");

describe("the element library", () => {
  it.each(standardComponents.map((definition) => [definition.type, definition] as const))(
    "%s accepts its own defaults, and its default children may go inside it",
    (_type, definition) => {
      expect(definition.propsSchema.safeParse(definition.defaultProps).success).toBe(true);
      expect(componentCategories).toContain(definition.category);
      for (const child of definition.defaultChildren ?? []) {
        expect(standardCatalogue.canContain(definition.type, child.type)).toBe(true);
      }
      const node = createNode({ type: definition.type }, standardCatalogue, createId);
      expect(node.type).toBe(definition.type);
    },
  );

  it("names every content field's prop in the props, and folds advanced options away", () => {
    for (const definition of standardComponents) {
      for (const field of definition.editableFields) {
        expect(Object.keys(definition.defaultProps), `${definition.type}.${field.prop}`).toContain(
          field.prop,
        );
      }
    }
    const video = standardCatalogue.find("video");
    expect(
      video?.editableFields.filter((field) => field.advanced).map((field) => field.prop),
    ).toEqual(["shape", "autoplayMuted", "loop", "captionsUrl"]);
  });

  it("keeps slides, tabs and accordion items inside their own element", () => {
    expect(standardCatalogue.canContain("carousel", "slide")).toBe(true);
    expect(standardCatalogue.canContain("carousel", "heading")).toBe(false);
    expect(standardCatalogue.canContain("section", "slide")).toBe(false);
    expect(standardCatalogue.canContain("tabs", "tabPanel")).toBe(true);
    expect(standardCatalogue.canContain("accordion", "accordionItem")).toBe(true);
    expect(standardCatalogue.canContain("collectionList", "card")).toBe(true);
  });

  it("marks the shop's and forms' elements with their plugin", () => {
    const byPlugin = (plugin: string) =>
      standardComponents
        .filter((definition) => definition.requiresPlugin === plugin)
        .map((definition) => definition.type);
    expect(byPlugin("commerce")).toContain("productGrid");
    expect(byPlugin("commerce")).toContain("addToCart");
    expect(byPlugin("forms")).toEqual(["formEmbed", "newsletterSignup"]);
  });

  it("only embeds https addresses from the allowed sites", () => {
    const embed = standardCatalogue.find("embed");
    const accepts = (url: string) => embed?.propsSchema.safeParse({ url }).success;
    expect(accepts("https://calendly.com/sam/30min")).toBe(true);
    expect(accepts("https://www.youtube-nocookie.com/embed/abc")).toBe(true);
    expect(accepts("http://calendly.com/sam")).toBe(false);
    expect(accepts("https://calendly.com.evil.example/")).toBe(false);
    expect(accepts("javascript:alert(1)")).toBe(false);
    expect(embedAllowedHosts).toContain("openstreetmap.org");
  });
});

describe("bound elements", () => {
  const item = {
    id: "post-1",
    fields: {
      title: "Sourdough at home",
      image: { src: "/media/loaf.jpg", alt: "A loaf", width: 800, height: 600 },
      body: { html: "<p>Flour and water.</p>" },
    },
  };

  it("shows the entry's fields in bound props and leaves the rest as typed", () => {
    expect(bindProps({ text: "Entry title", level: 3 }, { text: "title" }, item)).toEqual({
      text: "Sourdough at home",
      level: 3,
    });
    expect(bindProps({ src: "", alt: "", caption: "" }, { src: "image" }, item)).toMatchObject({
      src: "/media/loaf.jpg",
      alt: "A loaf",
    });
    expect(
      bindProps({ photo: { src: "", alt: "", assetId: null } }, { photo: "image" }, item),
    ).toEqual({
      photo: { src: "/media/loaf.jpg", alt: "A loaf", assetId: null },
    });
    expect(bindProps({ text: "Typed" }, { text: "data.missing" }, item)).toEqual({ text: "Typed" });
    expect(bindProps({ text: "Typed" }, undefined, item)).toEqual({ text: "Typed" });
  });

  it("keeps bindings through a save, and refuses odd ones", () => {
    const page = createEmptyPage();
    const heading = {
      ...createNode({ type: "heading" }, standardCatalogue, createId),
      bindings: { text: "title" },
    };
    const list = createNode(
      { type: "collectionList", props: { collection: "posts" } },
      standardCatalogue,
      createId,
    );
    const checked = validatePageDocument(
      { ...page, root: { ...page.root, children: [list, heading] } },
      standardCatalogue,
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.document.root.children[1]?.bindings).toEqual({ text: "title" });
    expect(
      findNodesOfType(checked.document.root, ["collectionList"]).map((node) => node.id),
    ).toEqual([list.id]);
    const odd = validatePageDocument(
      {
        ...page,
        root: { ...page.root, children: [{ ...heading, bindings: { text: "<script>" } }] },
      },
      standardCatalogue,
    );
    expect(odd.ok).toBe(false);
  });

  it("a new collection list starts with an item design bound to the entry", () => {
    const list = createNode({ type: "collectionList" }, standardCatalogue, createId);
    const card = list.children[0];
    expect(card?.bindings).toEqual({ href: "url" });
    expect(card?.children.map((child) => child.bindings)).toEqual([
      { src: "image" },
      { text: "publishedAt" },
      { text: "title" },
      { text: "excerpt" },
    ]);
  });

  it("turns a product into an item with its price in words", () => {
    const product: ShopProduct = {
      id: "p1",
      handle: "shirt",
      title: "Linen shirt",
      descriptionHtml: "<p>Cool in <strong>summer</strong>.</p>",
      url: "/products/shirt",
      images: [],
      options: [],
      priceRange: {
        min: { amount: 4500, currency: "GBP" },
        max: { amount: 6000, currency: "GBP" },
      },
      availableForSale: true,
      variants: [],
    };
    expect(productAsItem(product).fields).toMatchObject({
      title: "Linen shirt",
      price: "From £45.00",
      excerpt: "Cool in summer .",
    });
    expect(formatMoney({ amount: 4500, currency: "JPY" })).toBe("JP¥4,500");
  });
});
