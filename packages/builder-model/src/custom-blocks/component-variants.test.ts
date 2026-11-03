import { motionSpecSchema } from "@lintel/motion/schema";
import { describe, expect, it } from "vitest";
import { findDesignChanges } from "../client-editing/client-changes.js";
import { standardCatalogue } from "../components/component-catalogue.js";
import {
  createEmptyPage,
  type PageDocument,
  type PageNode,
} from "../document/page-document.schema.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import {
  type ComponentVariants,
  componentVariantsOf,
  componentVariantsSchema,
  designForVariant,
  editTarget,
  matchingLooks,
  noVariants,
  recordVariantEdit,
  resolveSelection,
  storedSelection,
  variantMatrix,
  variantProblems,
} from "./component-variants.js";
import type { CustomBlock } from "./custom-block.js";
import { detachBlockInstance, expandBlockInstances } from "./expand-blocks.js";
import { findSimilarElements, planComponentFromSimilar, shapeOf } from "./similar-elements.js";

/** A button: a box holding an icon and a label. */
function buttonDesign(): PageNode {
  return createNode(
    {
      type: "box",
      name: "Button",
      styles: { base: { paddingTop: "12px", backgroundColor: "#111111" } },
      children: [
        { type: "icon", name: "Icon", props: { name: "arrow-right" } },
        { type: "text", name: "Label", props: { text: "Read more" } },
      ],
    },
    standardCatalogue,
    createCountingNodeIds("d"),
  );
}

const buttonVariants: ComponentVariants = {
  properties: [
    {
      handle: "size",
      label: "Size",
      options: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
      default: "medium",
    },
    {
      handle: "style",
      label: "Style",
      options: [
        { value: "filled", label: "Filled" },
        { value: "outline", label: "Outline" },
      ],
      default: "filled",
    },
    {
      handle: "icon",
      label: "Icon",
      options: [
        { value: "on", label: "On" },
        { value: "off", label: "Off" },
      ],
      default: "on",
    },
  ],
  looks: [
    { when: { size: "small" }, elements: { d1: { styles: { base: { paddingTop: "6px" } } } } },
    {
      when: { style: "outline" },
      elements: {
        d1: {
          styles: { base: { borderColor: "#111111" } },
          removedStyles: ["base.backgroundColor"],
        },
      },
    },
    { when: { icon: "off" }, elements: { d2: { hidden: true } } },
    {
      when: { size: "small", style: "outline" },
      elements: { d1: { styles: { base: { paddingTop: "4px" } } } },
    },
  ],
  clientsMayChoose: false,
};

function button(variants: ComponentVariants | null = buttonVariants): CustomBlock {
  return {
    handle: "button",
    name: "Button",
    icon: "square",
    category: "",
    description: "",
    source: "site",
    properties: [],
    design: buttonDesign(),
    template: null,
    renamedProperties: {},
    ...(variants ? { variants } : {}),
  };
}

function instance(id: string, variant?: Record<string, string>): PageNode {
  return {
    id,
    type: "customBlock",
    name: "",
    props: { block: "button", values: {}, ...(variant ? { variant } : {}) },
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  };
}

function pageOf(...children: PageNode[]): PageNode {
  return { ...createEmptyPage().root, children };
}

function drawn(node: PageNode, block: CustomBlock = button()): PageNode {
  const page = expandBlockInstances(pageOf(node), { blocks: { button: block } });
  return page.children[0]?.children[0] as PageNode;
}

describe("variants of a component", () => {
  it("makes every combination of its values", () => {
    const matrix = variantMatrix(buttonVariants);
    expect(matrix).toHaveLength(12);
    expect(matrix[0]).toEqual({ size: "small", style: "filled", icon: "on" });
    expect(matrix.at(-1)).toEqual({ size: "large", style: "outline", icon: "off" });
    expect(variantMatrix(noVariants)).toEqual([{}]);
  });

  it("fills in defaults, ignores choices no longer offered, and stores only what differs", () => {
    expect(resolveSelection(buttonVariants, { size: "huge", style: "outline", gone: "x" })).toEqual(
      { size: "medium", style: "outline", icon: "on" },
    );
    expect(storedSelection(buttonVariants, { size: "medium", style: "outline" })).toEqual({
      style: "outline",
    });
    expect(editTarget(buttonVariants, { size: "medium", style: "filled", icon: "on" })).toEqual({});
  });

  it("lays matching looks over the design, the most specific last", () => {
    const looks = matchingLooks(buttonVariants, { size: "small", style: "outline" });
    expect(looks.map((look) => Object.keys(look.when).join("+"))).toEqual([
      "size",
      "style",
      "size+style",
    ]);
    const small = designForVariant(buttonDesign(), buttonVariants, { size: "small" });
    expect(small.styles.base).toEqual({ paddingTop: "6px", backgroundColor: "#111111" });
    const both = designForVariant(buttonDesign(), buttonVariants, {
      size: "small",
      style: "outline",
    });
    expect(both.styles.base).toEqual({ paddingTop: "4px", borderColor: "#111111" });
  });

  it("draws an instance with its chosen variant, and hides parts a variant turns off", () => {
    const plain = drawn(instance("i1"));
    expect(plain.id).toBe("i1-d1");
    expect(plain.styles.base.paddingTop).toBe("12px");
    expect(plain.children[0]?.hidden).toBe(false);
    const noIcon = drawn(instance("i2", { icon: "off", size: "large" }));
    expect(noIcon.children[0]?.hidden).toBe(true);
    expect(noIcon.styles.base.paddingTop).toBe("12px");
  });

  it("reads components saved before variants as having none", () => {
    const old = button(null);
    expect(componentVariantsOf(old)).toEqual(noVariants);
    const page = drawn(instance("i1", { size: "small" }), old);
    expect(page.styles.base.paddingTop).toBe("12px");
    expect(componentVariantsSchema.parse({})).toEqual(noVariants);
  });

  it("detaches an instance as the variant it shows", () => {
    const plain = detachBlockInstance(
      instance("i1", { size: "small" }),
      button(),
      createCountingNodeIds("n"),
    );
    expect(plain?.id).toBe("n1");
    expect(plain?.styles.base.paddingTop).toBe("6px");
  });
});

describe("editing a variant in the designer", () => {
  it("keeps edits with every value at its default as the design", () => {
    const edited = { ...buttonDesign(), name: "Main button" };
    const result = recordVariantEdit(buttonDesign(), buttonVariants, {}, edited);
    expect(result.design.name).toBe("Main button");
    expect(result.variants.looks).toHaveLength(buttonVariants.looks.length);
  });

  it("keeps a style change made while showing Large as Large's look, not the design's", () => {
    const shown = designForVariant(buttonDesign(), buttonVariants, { size: "large" });
    const edited = { ...shown, styles: { base: { ...shown.styles.base, paddingTop: "20px" } } };
    const result = recordVariantEdit(buttonDesign(), buttonVariants, { size: "large" }, edited);
    expect(result.design.styles.base.paddingTop).toBe("12px");
    const large = result.variants.looks.find((look) => look.when.size === "large");
    expect(large?.elements.d1?.styles?.base).toEqual({ paddingTop: "20px" });
    expect(
      designForVariant(result.design, result.variants, { size: "large" }).styles.base,
    ).toMatchObject({ paddingTop: "20px" });
  });

  it("hides a part deleted while showing a variant, and adds new parts to every variant", () => {
    const shown = designForVariant(buttonDesign(), buttonVariants, { style: "outline" });
    const added = createNode(
      { type: "text", name: "Badge", props: { text: "New" } },
      standardCatalogue,
      createCountingNodeIds("x"),
    );
    const edited = { ...shown, children: [shown.children[1] as PageNode, added] };
    const result = recordVariantEdit(buttonDesign(), buttonVariants, { style: "outline" }, edited);
    expect(result.design.children.map((child) => child.id)).toEqual(["d2", "d3", "x1"]);
    const outline = result.variants.looks.find(
      (look) => look.when.style === "outline" && Object.keys(look.when).length === 1,
    );
    expect(outline?.elements.d2).toEqual({ hidden: true });
    // The outline look itself was kept as it was.
    expect(outline?.elements.d1?.removedStyles).toEqual(["base.backgroundColor"]);
  });

  it("finds problems with a component's variants", () => {
    const broken: ComponentVariants = {
      ...buttonVariants,
      properties: [
        ...buttonVariants.properties,
        {
          handle: "size",
          label: "Size again",
          options: [
            { value: "a", label: "A" },
            { value: "a", label: "A" },
          ],
          default: "b",
        },
      ],
      looks: [{ when: { size: "tiny" }, elements: { nowhere: { hidden: true } } }],
    };
    const problems = variantProblems(broken, buttonDesign());
    expect(problems).toContain("Two variants are called “size”");
    expect(problems).toContain("Size again has “a” twice");
    expect(problems.some((problem) => problem.includes("isn’t one of its choices"))).toBe(true);
    expect(problems).toContain("A look changes an element “nowhere” the design doesn’t have");
    expect(variantProblems(buttonVariants, buttonDesign())).toEqual([]);
    expect(
      componentVariantsSchema.safeParse({
        properties: [
          { handle: "size", label: "Size", options: [{ value: "a", label: "A" }], default: "a" },
        ],
      }).success,
    ).toBe(false);
  });
});

/** Daniel's project list: eight rows, each a number, a title, a client and a year. */
function projectList(): PageNode {
  const rows = [
    ["01", "Harbour lights", "Port of Leith", "2021"],
    ["02", "Paper cranes", "Origami Ltd", "2022"],
    ["03", "North wind", "Fjord Air", "2022"],
    ["04", "Salt and stone", "Coast Trust", "2023"],
    ["05", "Night market", "Town Hall", "2023"],
    ["06", "Glasshouse", "Botanic Gardens", "2024"],
    ["07", "Long table", "Supper Club", "2024"],
    ["08", "Field notes", "Bird Society", "2025"],
  ];
  return createNode(
    {
      type: "page",
      children: rows.map(([number, title, client, year]) => ({
        type: "box",
        name: "Project",
        children: [
          { type: "text", name: "Number", props: { text: number } },
          { type: "heading", name: "Project title", props: { text: title, level: 3 } },
          { type: "text", name: "Client", props: { text: client } },
          { type: "text", name: "Year", props: { text: year } },
        ],
      })),
    },
    standardCatalogue,
    createCountingNodeIds("n"),
  );
}

const fadeIn = motionSpecSchema.parse({
  trigger: { type: "load" },
  targets: { type: "self" },
  tracks: [
    {
      property: "opacity",
      keyframes: [
        { offset: 0, value: 0 },
        { offset: 1, value: 1 },
      ],
    },
  ],
});

describe("making several similar elements one component", () => {
  it("finds the rows built the same way, by shared style or as siblings", () => {
    const page = projectList();
    const firstRow = page.children[0] as PageNode;
    expect(findSimilarElements(page, firstRow.id)).toHaveLength(8);
    expect(shapeOf(firstRow)).toBe("box(text,heading,text,text)");
    // Only rows with the same shared style, when there is one.
    const styled: PageNode = {
      ...page,
      children: page.children.map((row, index) =>
        index < 5 ? { ...row, sharedStyle: "project" } : row,
      ),
    };
    expect(findSimilarElements(styled, firstRow.id)).toHaveLength(5);
    // A heading on its own has no similar siblings.
    expect(findSimilarElements(page, firstRow.children[1]?.id ?? "")).toEqual([]);
  });

  it("turns what differs into properties, each row keeping its own words", () => {
    const page = projectList();
    const plan = planComponentFromSimilar(page.children, standardCatalogue);
    expect(plan?.properties.map((property) => `${property.handle}:${property.type}`)).toEqual([
      "number:text",
      "project_title:text",
      "client:text",
      "year:text",
    ]);
    const second = page.children[1]?.id ?? "";
    expect(plan?.values[second]).toEqual({
      number: "02",
      project_title: "Paper cranes",
      client: "Origami Ltd",
      year: "2022",
    });
    expect(plan?.parts[1]?.shown).toHaveLength(8);
  });

  it("animates the title in all eight rows when the component's title is animated", () => {
    const page = projectList();
    const plan = planComponentFromSimilar(page.children, standardCatalogue);
    if (!plan) throw new Error("no plan");
    const design = plan.design;
    const title = design.children[1] as PageNode;
    // The designer animates the title once, in the component.
    const animated: PageNode = {
      ...design,
      children: design.children.map((child) =>
        child.id === title.id
          ? { ...child, animations: [{ spec: fadeIn, presetId: "fade-in" }], effects: undefined }
          : child,
      ),
    };
    const component: CustomBlock = {
      handle: "project",
      name: "Project",
      icon: "square",
      category: "",
      description: "",
      source: "site",
      properties: plan.properties,
      design: animated,
      template: null,
      renamedProperties: {},
    };
    const instances = page.children.map((row) => ({
      ...row,
      type: "customBlock",
      props: { block: "project", values: plan.values[row.id] ?? {} },
      children: [],
    }));
    const drawnPage = expandBlockInstances(pageOf(...instances), {
      blocks: { project: component },
    });
    const titles = drawnPage.children.map((row) => row.children[0]?.children[1]);
    expect(titles).toHaveLength(8);
    for (const [index, drawnTitle] of titles.entries()) {
      expect(drawnTitle?.animations?.[0]?.presetId).toBe("fade-in");
      expect(drawnTitle?.id).toBe(`${instances[index]?.id}-${title.id}`);
    }
    expect(titles[3]?.props.text).toBe("Salt and stone");
  });

  it("keeps an animation added to one row that isn't the first, for all eight", () => {
    const page = projectList();
    const fourth = page.children[3] as PageNode;
    const animatedTitle = { ...(fourth.children[1] as PageNode), animations: [{ spec: fadeIn }] };
    const rows = page.children.map((row) =>
      row.id === fourth.id
        ? { ...row, children: row.children.map((c, i) => (i === 1 ? animatedTitle : c)) }
        : row,
    );
    const plan = planComponentFromSimilar(rows, standardCatalogue);
    expect(plan?.design.children[1]?.animations).toHaveLength(1);
    expect(plan?.sharedMotion).toEqual(["Project title"]);
  });

  it("says when pictures can't stay separate, rather than losing them quietly", () => {
    const row = (src: string, id: string) =>
      createNode(
        { type: "box", children: [{ type: "image", name: "Photo", props: { src } }] },
        standardCatalogue,
        createCountingNodeIds(id),
      );
    const plan = planComponentFromSimilar(
      [row("/a.jpg", "a"), row("/b.jpg", "b")],
      standardCatalogue,
    );
    expect(plan?.properties).toEqual([]);
    expect(plan?.notKept).toEqual(["Photo"]);
  });

  it("points animations at each instance's own parts", () => {
    const design = buttonDesign();
    const pointing = motionSpecSchema.parse({
      ...fadeIn,
      targets: { type: "nodes", nodeIds: ["d3"] },
    });
    const component = button(noVariants);
    component.design = { ...design, animations: [{ spec: pointing }] };
    const first = drawn(instance("i1"), component);
    expect(first.animations?.[0]?.spec.targets).toEqual({ type: "nodes", nodeIds: ["i1-d3"] });
  });
});

describe("what clients may change on a component", () => {
  function documentWith(node: PageNode): PageDocument {
    return { ...createEmptyPage(), root: pageOf(node) };
  }

  it("lets clients fill in properties, and choose a variant only where allowed", () => {
    const before = documentWith(instance("i1"));
    const filled = documentWith({
      ...instance("i1"),
      props: { block: "button", values: { label: "Go" } },
    });
    expect(findDesignChanges(before, filled, standardCatalogue)).toEqual([]);
    const restyled = documentWith(instance("i1", { size: "small" }));
    expect(findDesignChanges(before, restyled, standardCatalogue)).toHaveLength(1);
    expect(
      findDesignChanges(before, restyled, standardCatalogue, {
        mayChooseVariant: (component) => component === "button",
      }),
    ).toEqual([]);
    const swapped = documentWith({ ...instance("i1"), props: { block: "other", values: {} } });
    expect(
      findDesignChanges(before, swapped, standardCatalogue, { mayChooseVariant: () => true }),
    ).toHaveLength(1);
  });
});
