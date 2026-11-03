import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { validatePageDocument } from "../document/validate-page.js";
import {
  createEmptyPage,
  type PageDocument,
  type PageNode,
} from "../document/page-document.schema.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { duplicateNode, removeNode, updateNode } from "../tree/tree-changes.js";
import { findNode } from "../tree/tree-queries.js";
import {
  clientEditableFields,
  clientEditsOf,
  clientMayEditText,
  defaultClientEdits,
} from "./client-content.js";
import { findDesignChanges } from "./client-changes.js";

const find = (type: string) => standardCatalogue.find(type);

function samplePage(): PageDocument {
  const createId = createCountingNodeIds();
  const section = createNode(
    {
      type: "section",
      children: [
        { type: "heading", props: { text: "Fresh bread daily" } },
        { type: "text", props: { text: "Baked before sunrise." } },
        { type: "image" },
        { type: "button", props: { label: "Order", href: "/order" } },
        { type: "box", children: [{ type: "card" }, { type: "card" }] },
        { type: "gallery", props: { pictures: [{ image: { src: "", alt: "One" } }] } },
      ],
    },
    standardCatalogue,
    createId,
  );
  const page = { ...createEmptyPage(), root: { ...createEmptyPage().root, children: [section] } };
  const checked = validatePageDocument(page, standardCatalogue);
  if (!checked.ok) throw new Error(checked.problems[0]?.message);
  return checked.document;
}

const section = (page: PageDocument) => page.root.children[0] as PageNode;
const child = (page: PageDocument, index: number) => section(page).children[index] as PageNode;
const withRoot = (page: PageDocument, root: PageNode): PageDocument => ({ ...page, root });
const change = (page: PageDocument, nodeId: string, update: (node: PageNode) => PageNode) =>
  withRoot(page, updateNode(page.root, nodeId, update));
const changes = (before: PageDocument, after: PageDocument) =>
  findDesignChanges(before, after, standardCatalogue);

describe("what clients may change", () => {
  it("defaults to words for text, pictures for pictures, words and links for buttons", () => {
    expect(defaultClientEdits(find("heading"))).toEqual(["words"]);
    expect(defaultClientEdits(find("image"))).toEqual(["pictures"]);
    expect(defaultClientEdits(find("button"))).toEqual(["words", "links"]);
    expect(defaultClientEdits(find("section"))).toEqual([]);
    expect(defaultClientEdits(find("codeBlock"))).toEqual([]);
  });

  it("follows the designer's choice, and only kinds the element has", () => {
    const button = child(samplePage(), 3);
    expect([...clientEditsOf({ ...button, clientEdits: ["links"] }, find("button"))]).toEqual([
      "links",
    ]);
    expect([...clientEditsOf({ ...button, clientEdits: [] }, find("button"))]).toEqual([]);
    expect([...clientEditsOf({ ...button, clientEdits: ["pictures"] }, find("button"))]).toEqual(
      [],
    );
  });

  it("shows clients only the fields they may change", () => {
    const button = child(samplePage(), 3);
    expect(clientEditableFields(button, find("button")).map((field) => field.prop)).toEqual([
      "label",
      "href",
    ]);
    expect(
      clientEditableFields({ ...button, clientEdits: ["words"] }, find("button")).map(
        (field) => field.prop,
      ),
    ).toEqual(["label"]);
    expect(clientMayEditText(child(samplePage(), 0), find("heading"), "text")).toBe(true);
    expect(
      clientMayEditText({ ...child(samplePage(), 0), clientEdits: [] }, find("heading"), "text"),
    ).toBe(false);
  });
});

describe("a client's save", () => {
  it("accepts new words, a new picture and a new link", () => {
    const page = samplePage();
    let after = change(page, child(page, 0).id, (node) => ({
      ...node,
      props: { ...node.props, text: "Bread, warm" },
    }));
    after = change(after, child(page, 2).id, (node) => ({
      ...node,
      props: { ...node.props, src: "/media/loaf.jpg", assetId: "a1", alt: "A loaf" },
    }));
    after = change(after, child(page, 3).id, (node) => ({
      ...node,
      props: { ...node.props, label: "Buy now", href: "/shop" },
    }));
    expect(changes(page, after)).toEqual([]);
  });

  it("refuses a style, a layout change, a new element and a removed one", () => {
    const page = samplePage();
    const heading = child(page, 0);
    const styled = change(page, heading.id, (node) => ({
      ...node,
      styles: { base: { color: "red" } },
    }));
    expect(changes(page, styled)).toEqual([{ nodeId: heading.id, where: "Heading" }]);

    const level = change(page, heading.id, (node) => ({
      ...node,
      props: { ...node.props, level: 4 },
    }));
    expect(changes(page, level)).toHaveLength(1);

    const removed = withRoot(page, removeNode(page.root, heading.id));
    expect(changes(page, removed)).toHaveLength(1);

    const added = change(page, section(page).id, (node) => ({
      ...node,
      children: [...node.children, { ...heading, id: "new1" }],
    }));
    expect(changes(page, added)).toHaveLength(1);
  });

  it("refuses words where the designer said nothing, and its own settings", () => {
    const page = change(samplePage(), child(samplePage(), 0).id, (node) => ({
      ...node,
      clientEdits: [],
    }));
    const typed = change(page, child(page, 0).id, (node) => ({
      ...node,
      props: { ...node.props, text: "Mine now" },
    }));
    expect(changes(page, typed)).toHaveLength(1);
    const reopened = change(page, child(page, 0).id, (node) => ({
      ...node,
      clientEdits: ["words"],
    }));
    expect(changes(page, reopened)).toHaveLength(1);
  });

  it("adds and removes items only where clients may add more", () => {
    const page = samplePage();
    const box = child(page, 4);
    const createId = createCountingNodeIds("copy");
    const firstCard = box.children[0] as PageNode;
    const duplicated = withRoot(page, duplicateNode(page.root, firstCard.id, createId).root);
    expect(changes(page, duplicated)).toHaveLength(1);

    const open = change(page, box.id, (node) => ({ ...node, clientRepeats: true }));
    const copied = withRoot(open, duplicateNode(open.root, firstCard.id, createId).root);
    expect(changes(open, copied)).toEqual([]);
    const fewer = withRoot(open, removeNode(open.root, firstCard.id));
    expect(changes(open, fewer)).toEqual([]);
    // Every item gone leaves nothing to copy.
    const none = change(open, box.id, (node) => ({ ...node, children: [] }));
    expect(changes(open, none)).toHaveLength(1);
    // A "copy" that looks different is a new design.
    const restyled = withRoot(
      open,
      updateNode(copied.root, box.id, (node) => ({
        ...node,
        children: node.children.map((each, index) =>
          index === 1 ? { ...each, styles: { base: { color: "red" } } } : each,
        ),
      })),
    );
    expect(changes(open, restyled)).toHaveLength(1);
    // Items keep their order.
    const swapped = change(open, box.id, (node) => ({
      ...node,
      children: [...node.children].reverse(),
    }));
    expect(changes(open, swapped)).toHaveLength(1);
  });

  it("adds pictures to a gallery only where clients may add more", () => {
    const page = samplePage();
    const gallery = child(page, 5);
    const add = (doc: PageDocument) =>
      change(doc, gallery.id, (node) => ({
        ...node,
        props: {
          ...node.props,
          pictures: [
            ...(node.props.pictures as unknown[]),
            { image: { src: "/two.jpg", alt: "Two", assetId: null }, caption: "" },
          ],
        },
      }));
    expect(changes(page, add(page))).toHaveLength(1);
    const open = change(page, gallery.id, (node) => ({ ...node, clientRepeats: true }));
    expect(changes(open, add(open))).toEqual([]);
  });

  it("treats a first design as a change, and an unchanged page as none", () => {
    const page = samplePage();
    expect(changes(page, page)).toEqual([]);
    expect(findDesignChanges(null, page, standardCatalogue).length).toBeGreaterThan(0);
    expect(findNode(page.root, child(page, 0).id)).toBeDefined();
  });
});
