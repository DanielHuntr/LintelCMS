import {
  type ComponentVariants,
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type CustomBlock,
  emptySiteDesign,
  type PageDocument,
  type PageNode,
  type SiteDesign,
  standardCatalogue,
} from "@lintel/builder-model";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { blockInsertItems } from "./block-commands.js";
import type { BlockMaster, BuilderBlocks, NewBlockDraft } from "./blocks-context.js";
import { variantsFromRows } from "./ComponentVariantBar.js";

const sizes: ComponentVariants = {
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
  ],
  looks: [
    { when: { size: "small" }, elements: { d1: { styles: { base: { paddingTop: "4px" } } } } },
  ],
  clientsMayChoose: false,
};

function buttonComponent(variants: ComponentVariants = sizes): CustomBlock {
  return {
    handle: "button",
    name: "Button",
    icon: "square",
    category: "",
    description: "",
    source: "site",
    properties: [{ handle: "label", label: "Label", type: "text" }],
    design: createNode(
      {
        type: "box",
        name: "Button",
        children: [
          { type: "text", name: "Label", props: { text: "Go" }, bindings: { text: "label" } },
        ],
      },
      standardCatalogue,
      createCountingNodeIds("d"),
    ),
    template: null,
    renamedProperties: {},
    variants,
  };
}

function instance(id: string): PageNode {
  return {
    id,
    type: "customBlock",
    name: "Button",
    props: { block: "button", values: {} },
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  };
}

function pageWith(children: PageNode[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

/** Daniel's project list: eight rows, each a number, a title, a client and a year. */
function projectRows(sharedStyle?: string): PageNode[] {
  return ["Harbour lights", "Paper cranes", "North wind", "Salt and stone"]
    .concat(["Night market", "Glasshouse", "Long table", "Field notes"])
    .map((title, index) =>
      createNode(
        {
          type: "box",
          name: "Project",
          children: [
            { type: "text", name: "Number", props: { text: `0${index + 1}` } },
            { type: "heading", name: "Project title", props: { text: title, level: 3 } },
            { type: "text", name: "Client", props: { text: `Client ${index + 1}` } },
            { type: "text", name: "Year", props: { text: String(2018 + index) } },
          ],
        },
        standardCatalogue,
        createCountingNodeIds(`r${index}-`),
      ),
    )
    .map((row) => (sharedStyle ? { ...row, sharedStyle } : row));
}

function renderBuilder(
  document: PageDocument,
  blocks: BuilderBlocks,
  options: { contentOnly?: boolean; siteDesign?: SiteDesign; master?: BlockMaster } = {},
) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      blocks={blocks}
      blockMaster={options.master}
      contentOnly={options.contentOnly}
      createId={createCountingNodeIds("new")}
      siteDesign={options.siteDesign ? { value: options.siteDesign } : undefined}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes", clientTourSeen: "yes" })}
    />,
  );
  return { latest: () => onChange.mock.lastCall?.[0] as PageDocument };
}

/** What the canvas frame says when something on it is pressed. */
function selectOnCanvas(nodeId: string) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: document.querySelector("iframe")?.contentWindow ?? null,
        data: { type: "select", nodeId },
      }),
    );
  });
}

const layers = () => within(screen.getByRole("tree", { name: "Layers" }));

describe("components with variants in the builder", () => {
  it("shows a component's design as a sketch in Insert", () => {
    const [item] = blockInsertItems([buttonComponent()]);
    expect(item?.preview?.type).toBe("box");
  });

  it("chooses an instance's variant in its panel, storing only what differs", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith([instance("one")]), {
      library: [buttonComponent()],
      canManage: false,
    });
    await user.click(layers().getByRole("treeitem", { name: "Button" }));
    const panel = screen.getByRole("complementary", { name: "Selected element" });
    const size = within(panel).getByRole("radiogroup", { name: "Size" });
    expect(within(size).getByRole("radio", { name: "Medium" })).toBeChecked();
    await user.click(within(size).getByRole("radio", { name: "Small" }));
    expect(latest().root.children[0]?.props.variant).toEqual({ size: "small" });
    await user.click(within(size).getByRole("radio", { name: "Medium" }));
    expect(latest().root.children[0]?.props.variant).toBeUndefined();
  });

  it("lets clients fill in properties, and hides variants unless clients may choose", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(
      pageWith([instance("one")]),
      { library: [buttonComponent()], canManage: false },
      { contentOnly: true },
    );
    selectOnCanvas("one");
    const panel = screen.getByRole("complementary");
    expect(within(panel).queryByRole("radiogroup", { name: "Size" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Detach/ })).not.toBeInTheDocument();
    await user.type(within(panel).getByLabelText("Label"), "Buy");
    expect(latest().root.children[0]?.props.values).toEqual({ label: "Buy" });
  });

  it("offers clients the variants when the designer allows it", () => {
    renderBuilder(
      pageWith([instance("one")]),
      { library: [buttonComponent({ ...sizes, clientsMayChoose: true })], canManage: false },
      { contentOnly: true },
    );
    selectOnCanvas("one");
    expect(screen.getByRole("radiogroup", { name: "Size" })).toBeInTheDocument();
  });

  it("makes eight similar rows one component, each keeping its own words, in one Undo", async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (draft: NewBlockDraft) => ({
      ...buttonComponent(),
      handle: "project",
      name: draft.name,
      properties: draft.properties,
      design: draft.design,
      variants: undefined,
    }));
    const { latest } = renderBuilder(pageWith(projectRows()), {
      library: [],
      canManage: true,
      create,
    });
    await user.click(layers().getAllByRole("treeitem", { name: "Project" })[0] as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Make these 8 one component" }));
    const dialog = screen.getByRole("dialog", { name: "Make these 8 one component" });
    expect(within(dialog).getByText("Project title")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Harbour lights, Paper cranes, North wind and 5 more/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Make component" }));

    const draft = create.mock.calls[0]?.[0];
    expect(draft?.name).toBe("Project");
    expect(draft?.properties.map((property) => property.handle)).toEqual([
      "number",
      "project_title",
      "client",
      "year",
    ]);
    const rows = latest().root.children;
    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.type === "customBlock")).toBe(true);
    expect(rows[3]?.props.values).toMatchObject({ project_title: "Salt and stone" });
    expect(screen.getByRole("status")).toHaveTextContent("Made 8 elements into Project");

    await user.keyboard("{Control>}z{/Control}");
    expect(latest().root.children.every((row) => row.type === "box")).toBe(true);
  });

  it("suggests a component in Style when a shared style's elements are built alike", async () => {
    const user = userEvent.setup();
    const siteDesign: SiteDesign = {
      ...emptySiteDesign,
      sharedStyles: [{ id: "project", name: "Project row", styles: { base: {} } }],
    };
    renderBuilder(
      pageWith(projectRows("project")),
      { library: [], canManage: true, create: vi.fn() },
      { siteDesign },
    );
    await user.click(layers().getAllByRole("treeitem", { name: "Project" })[0] as HTMLElement);
    await user.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.getByText("Want changes inside these to follow too?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make them a component" }));
    expect(screen.getByRole("dialog", { name: "Make these 8 one component" })).toBeInTheDocument();
  });

  it("shows a variant bar over the canvas while designing a component", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const onVariantsChange = vi.fn();
    const component = buttonComponent();
    renderBuilder(
      pageWith([component.design as PageNode]),
      { library: [], canManage: false },
      {
        master: {
          block: component,
          isReadOnly: false,
          onPropertiesChange: vi.fn(),
          variants: sizes,
          selection: { size: "small" },
          onSelectionChange,
          onVariantsChange,
        },
      },
    );
    const bar = screen.getByRole("group", { name: "Variant to show and change" });
    expect(within(bar).getByText("Changes go to Small")).toBeInTheDocument();
    await user.click(within(bar).getByRole("radio", { name: "Large" }));
    expect(onSelectionChange).toHaveBeenCalledWith({ size: "large" });

    await user.click(within(bar).getByRole("button", { name: "Edit variants" }));
    const dialog = screen.getByRole("dialog", { name: "Variants of Button" });
    await user.click(within(dialog).getByRole("button", { name: "Add a variant" }));
    const names = within(dialog).getAllByRole("textbox", { name: "Name" });
    const choices = within(dialog).getAllByRole("textbox", { name: "Choices" });
    await user.type(names[1] as HTMLElement, "Style");
    await user.type(choices[1] as HTMLElement, "Filled, Outline");
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    const next = onVariantsChange.mock.lastCall?.[0] as ComponentVariants;
    expect(next.properties.map((property) => property.handle)).toEqual(["size", "style"]);
    expect(next.properties[1]?.default).toBe("filled");
    // Small's look stays with it.
    expect(next.looks).toHaveLength(1);
  });
});

describe("typing variants", () => {
  it("keeps choices' values by name, so their looks stay", () => {
    const result = variantsFromRows(
      [{ key: "size", handle: "size", name: "Size", choices: "Large, small, Huge" }],
      sizes,
      true,
    );
    if ("problem" in result) throw new Error(result.problem);
    expect(result.properties[0]?.options).toEqual([
      { value: "large", label: "Large" },
      { value: "small", label: "small" },
      { value: "huge", label: "Huge" },
    ]);
    expect(result.properties[0]?.default).toBe("large");
    expect(result.clientsMayChoose).toBe(true);
    expect(variantsFromRows([{ key: "a", name: "Tone", choices: "Warm" }], sizes, false)).toEqual({
      problem: "choices",
      name: "Tone",
    });
  });

  it("forgets looks for choices that were removed", () => {
    const result = variantsFromRows(
      [{ key: "size", handle: "size", name: "Size", choices: "Medium, Large" }],
      sizes,
      false,
    );
    if ("problem" in result) throw new Error(result.problem);
    expect(result.looks).toEqual([]);
  });
});
