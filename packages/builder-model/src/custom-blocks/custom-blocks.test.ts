import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createEmptyPage, type PageNode } from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { BlockTemplateError, fillBlockTemplate, templateSlots } from "./block-template.js";
import { type CustomBlock, currentValues, findBlockInstances } from "./custom-block.js";
import { detachBlockInstance, expandBlockInstances } from "./expand-blocks.js";
import {
  buildBlockDesign,
  cannotMakeBlockFrom,
  findPropertyCandidates,
  handleFromLabel,
} from "./make-block.js";

/** A team card designed in the builder: a box with a photo, a name, a role and a link. */
function teamCardDesign(): PageNode {
  const createId = createCountingNodeIds("d");
  return createNode(
    {
      type: "box",
      name: "Card",
      styles: { base: { backgroundColor: "#ffffff" } },
      children: [
        { type: "image", name: "Photo", props: { src: "/placeholder.jpg", alt: "Someone" } },
        { type: "heading", name: "Name", props: { text: "Your name", level: 3 } },
        { type: "text", name: "Role", props: { text: "What you do" } },
        {
          type: "button",
          name: "LinkedIn",
          props: { label: "LinkedIn", href: "https://linkedin.com" },
        },
      ],
    },
    standardCatalogue,
    createId,
  );
}

function teamCard(): CustomBlock {
  const design = teamCardDesign();
  const candidates = findPropertyCandidates(design, standardCatalogue);
  const pick = (elementName: string, binding: string) =>
    candidates.find(
      (candidate) => candidate.elementName === elementName && candidate.binding === binding,
    );
  const choices = [
    { candidateId: pick("Name", "text")?.id ?? "", label: "Name" },
    { candidateId: pick("Photo", "src")?.id ?? "", label: "Photo" },
    { candidateId: pick("Role", "text")?.id ?? "", label: "Role" },
    { candidateId: pick("LinkedIn", "visible")?.id ?? "", label: "Show LinkedIn" },
    { candidateId: pick("Card", "style.backgroundColor")?.id ?? "", label: "Accent" },
  ];
  const { design: bound, properties } = buildBlockDesign(design, choices, standardCatalogue);
  return {
    handle: "team_card",
    name: "Team card",
    icon: "user",
    category: "Team",
    description: "",
    source: "site",
    properties,
    design: bound,
    template: null,
    renamedProperties: {},
  };
}

function pageWith(...children: PageNode[]): PageNode {
  return { ...createEmptyPage().root, children };
}

function instance(id: string, values: Record<string, unknown>): PageNode {
  return {
    id,
    type: "customBlock",
    name: "",
    props: { block: "team_card", values },
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  };
}

const pictures = {
  "asset-1": { src: "/media/ada.jpg", alt: "Ada smiling", width: 400, height: 400 },
};

describe("making a block from a design", () => {
  it("offers the words, pictures, links, show and hide, colours and lists it has", () => {
    const candidates = findPropertyCandidates(teamCardDesign(), standardCatalogue);
    const kinds = candidates.map((candidate) => `${candidate.elementName}:${candidate.kind}`);
    expect(kinds).toContain("Name:multilineText");
    expect(kinds).toContain("Photo:image");
    expect(kinds).toContain("LinkedIn:link");
    expect(kinds).toContain("LinkedIn:visible");
    expect(kinds).toContain("Card:colour");
    expect(kinds).not.toContain("Card:visible");
    expect(kinds).not.toContain("Photo:multilineText");
  });

  it("turns ticked parts into properties with the field editor's types, and binds them", () => {
    const block = teamCard();
    expect(block.properties.map(({ handle, type }) => `${handle}:${type}`)).toEqual([
      "name:text",
      "photo:image",
      "role:text",
      "show_linkedin:toggle",
      "accent:colour",
    ]);
    const [photo, name] = block.design?.children ?? [];
    expect(name?.bindings).toEqual({ text: "name" });
    expect(photo?.bindings).toEqual({ src: "photo" });
    expect(block.design?.bindings).toEqual({ "style.backgroundColor": "accent" });
  });

  it("makes handles editors never have to see, unique within the block", () => {
    const taken = new Set(["name"]);
    expect(handleFromLabel("Show LinkedIn", taken)).toBe("show_linkedin");
    expect(handleFromLabel("Name", taken)).toBe("name_2");
    expect(handleFromLabel("2nd line", taken)).toBe("p_2nd_line");
    expect(handleFromLabel("¡¿", taken)).toBe("property");
  });

  it("won't make a block of the page, or of something with a block inside", () => {
    expect(cannotMakeBlockFrom(createEmptyPage().root)).toBe("page");
    expect(cannotMakeBlockFrom(pageWith(instance("i1", {})).children[0] as PageNode)).toBe(
      "hasBlock",
    );
    expect(cannotMakeBlockFrom(teamCardDesign())).toBeNull();
  });

  it("makes a list of the first of several children of the same kind", () => {
    const grid = createNode(
      {
        type: "grid",
        name: "People",
        children: [
          { type: "box", children: [{ type: "heading", name: "Name", props: { text: "One" } }] },
          { type: "box", children: [{ type: "heading", name: "Name", props: { text: "Two" } }] },
        ],
      },
      standardCatalogue,
      createCountingNodeIds("g"),
    );
    const list = findPropertyCandidates(grid, standardCatalogue).find(
      ({ kind }) => kind === "items",
    );
    const { design, properties } = buildBlockDesign(
      grid,
      [{ candidateId: list?.id ?? "", label: "People" }],
      standardCatalogue,
    );
    expect(properties[0]).toMatchObject({ handle: "people", type: "repeater" });
    expect(properties[0]?.options).toEqual({
      fields: [expect.objectContaining({ handle: "name", type: "text" })],
    });
    expect(design.children).toHaveLength(1);
    expect(design.bindings).toEqual({ items: "people" });

    const block = { ...teamCard(), design, properties };
    const page = pageWith(
      instance("i1", {
        people: [
          { id: "r1", data: { name: "Ada" } },
          { id: "r2", data: { name: "Grace" } },
          { id: "r3", data: {} },
        ],
      }),
    );
    const expanded = expandBlockInstances(page, { blocks: { team_card: block } });
    const rows = expanded.children[0]?.children[0]?.children ?? [];
    expect(rows.map((row) => row.children[0]?.props.text)).toEqual(["Ada", "Grace", "One"]);
  });
});

describe("drawing instances", () => {
  it("puts each property's value where it is bound, and keeps the design's when empty", () => {
    const block = teamCard();
    const page = pageWith(
      instance("ada", {
        name: "Ada Lovelace",
        photo: "asset-1",
        show_linkedin: false,
        accent: "#ffe4e1",
      }),
      instance("blank", {}),
    );
    const expanded = expandBlockInstances(page, { blocks: { team_card: block }, pictures });
    const [ada, blank] = expanded.children.map((node) => node.children[0]);
    expect(ada?.id).toBe(`ada-${block.design?.id}`);
    expect(ada?.styles.base.backgroundColor).toBe("#ffe4e1");
    expect(ada?.children.map((child) => child.name)).toEqual(["Photo", "Name", "Role"]);
    expect(ada?.children[0]?.props).toMatchObject({ src: "/media/ada.jpg", alt: "Ada smiling" });
    expect(ada?.children[1]?.props.text).toBe("Ada Lovelace");
    expect(ada?.children[1]?.bindings).toBeUndefined();
    expect(blank?.children[1]?.props.text).toBe("Your name");
    expect(blank?.children.map((child) => child.name)).toContain("LinkedIn");
  });

  it("gives back the same tree when there is nothing to fill in", () => {
    const page = pageWith(teamCardDesign());
    expect(expandBlockInstances(page, { blocks: {} })).toBe(page);
    expect(expandBlockInstances(pageWith(instance("x", {})), {})).toEqual(
      pageWith(instance("x", {})),
    );
  });

  it("updates every instance when the block's design changes", () => {
    const block = teamCard();
    const page = pageWith(instance("one", { name: "Ada" }), instance("two", { name: "Grace" }));
    const changedDesign: PageNode = {
      ...(block.design as PageNode),
      styles: { base: { backgroundColor: "#000000", opacity: "0.5" } },
    };
    const before = expandBlockInstances(page, { blocks: { team_card: block } });
    const after = expandBlockInstances(page, {
      blocks: { team_card: { ...block, design: changedDesign } },
    });
    expect(before.children.map((node) => node.children[0]?.styles.base.opacity)).toEqual([
      undefined,
      undefined,
    ]);
    expect(after.children.map((node) => node.children[0]?.styles.base.opacity)).toEqual([
      "0.5",
      "0.5",
    ]);
    expect(after.children.map((node) => node.children[0]?.children[1]?.props.text)).toEqual([
      "Ada",
      "Grace",
    ]);
  });

  it("refuses colours that could break out of their declaration", () => {
    const block = teamCard();
    const page = pageWith(instance("x", { accent: "red; background: url(evil)" }));
    const expanded = expandBlockInstances(page, { blocks: { team_card: block } });
    expect(expanded.children[0]?.children[0]?.styles.base.backgroundColor).toBe("#ffffff");
  });

  it("finds renamed properties' values under their new names", () => {
    expect(currentValues({ title: "Ada", other: 1 }, { title: "name" })).toEqual({
      name: "Ada",
      other: 1,
    });
    expect(currentValues({ a: 1 }, { a: "b", b: "c" })).toEqual({ c: 1 });
    expect(currentValues({ a: 1, b: 2 }, { a: "b" })).toEqual({ b: 2 });
    const block = { ...teamCard(), renamedProperties: { full_name: "name" } };
    const expanded = expandBlockInstances(pageWith(instance("x", { full_name: "Ada" })), {
      blocks: { team_card: block },
    });
    expect(expanded.children[0]?.children[0]?.children[1]?.props.text).toBe("Ada");
  });

  it("detaches an instance into plain elements with its values typed in", () => {
    const block = teamCard();
    const plain = detachBlockInstance(
      instance("ada", { name: "Ada" }),
      block,
      createCountingNodeIds("new"),
      pictures,
    );
    expect(plain?.id).toBe("new1");
    expect(plain?.children[1]?.props.text).toBe("Ada");
    const all = JSON.stringify(plain);
    expect(all).not.toContain("bindings");
    expect(
      findBlockInstances(pageWith(instance("a", {}), instance("b", {})), "team_card"),
    ).toHaveLength(2);
  });

  it("is a known element pages can be saved with", () => {
    const checked = validatePageDocument(
      { version: 1, root: pageWith(instance("x", { name: "Ada" })) },
      standardCatalogue,
    );
    expect(checked.ok).toBe(true);
    const refused = validatePageDocument(
      { version: 1, root: pageWith({ ...instance("x", {}), props: { block: "Not A Handle" } }) },
      standardCatalogue,
    );
    expect(refused.ok).toBe(false);
  });
});

describe("HTML templates", () => {
  const properties = [
    { handle: "name", label: "Name", type: "text" },
    { handle: "photo", label: "Photo", type: "image" },
    { handle: "link", label: "Link", type: "link" },
    { handle: "show_linkedin", label: "Show LinkedIn", type: "toggle" },
    {
      handle: "skills",
      label: "Skills",
      type: "repeater",
      options: { fields: [{ handle: "label", label: "Label", type: "text" }] },
    },
  ];
  const template =
    '<article><img src="{{photo}}" alt="{{photo.alt}}"><h3>{{name}}</h3>' +
    '{{#show_linkedin}}<a href="{{link}}">{{link.label}}</a>{{/show_linkedin}}' +
    "{{^name}}<p>No name yet</p>{{/name}}<ul>{{#skills}}<li>{{label}}</li>{{/skills}}</ul></article>";

  it("fills slots with escaped values, shows sections and repeats lists", () => {
    const html = fillBlockTemplate(
      template,
      {
        name: "Ada <Lovelace>",
        photo: "asset-1",
        link: { url: "https://example.com", label: "Profile" },
        show_linkedin: true,
        skills: [
          { id: "a", data: { label: "Maths" } },
          { id: "b", data: { label: "Engines" } },
        ],
      },
      properties,
      pictures,
    );
    expect(html).toBe(
      '<article><img src="/media/ada.jpg" alt="Ada smiling"><h3>Ada &lt;Lovelace&gt;</h3>' +
        '<a href="https://example.com">Profile</a><ul><li>Maths</li><li>Engines</li></ul></article>',
    );
  });

  it("leaves out what is switched off and shows what stands in for empty values", () => {
    const html = fillBlockTemplate(template, { show_linkedin: false }, properties);
    expect(html).toBe('<article><img src="" alt=""><h3></h3><p>No name yet</p><ul></ul></article>');
  });

  it("names the slots a template uses, and refuses sections that don't close", () => {
    expect(templateSlots(template)).toEqual(
      ["photo", "name", "show_linkedin", "name", "skills"].filter(
        (value, index, all) => all.indexOf(value) === index,
      ),
    );
    expect(() => fillBlockTemplate("{{#name}}open", {}, properties)).toThrow(BlockTemplateError);
    expect(() => fillBlockTemplate("{{/name}}", {}, properties)).toThrow(/never opened/);
  });
});
