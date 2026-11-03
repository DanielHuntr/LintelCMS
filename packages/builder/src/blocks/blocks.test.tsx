import {
  buildBlockDesign,
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type CustomBlock,
  findPropertyCandidates,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";
import {
  blockBindableFields,
  blockInsertItems,
  currentChoices,
  remapBlockDesign,
} from "./block-commands.js";
import type { BuilderBlocks, NewBlockDraft } from "./blocks-context.js";

function cardDesign(): PageNode {
  return createNode(
    {
      type: "box",
      name: "Team card",
      children: [
        { type: "heading", name: "Name", props: { text: "Your name", level: 3 } },
        { type: "text", name: "Role", props: { text: "What you do" } },
      ],
    },
    standardCatalogue,
    createCountingNodeIds("d"),
  );
}

function teamCard(): CustomBlock {
  const design = cardDesign();
  const candidates = findPropertyCandidates(design, standardCatalogue);
  const nameCandidate = candidates.find((candidate) => candidate.elementName === "Name");
  const built = buildBlockDesign(
    design,
    [{ candidateId: nameCandidate?.id ?? "", label: "Name" }],
    standardCatalogue,
  );
  return {
    handle: "team_card",
    name: "Team card",
    icon: "users",
    category: "Team",
    description: "A person with their role",
    source: "site",
    properties: built.properties,
    design: built.design,
    template: null,
    renamedProperties: {},
  };
}

function pageWith(children: PageNode[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

function instance(id: string, values: Record<string, unknown>): PageNode {
  return {
    id,
    type: "customBlock",
    name: "Team card",
    props: { block: "team_card", values },
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  };
}

function renderBuilder(document: PageDocument, blocks: BuilderBlocks) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="About us"
      canEditCode={false}
      blocks={blocks}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes" })}
    />,
  );
  return { latest: () => onChange.mock.lastCall?.[0] as PageDocument };
}

describe("the site's blocks in the builder", () => {
  it("lists them first under Your site's blocks, searchable by name and group", () => {
    const items = blockInsertItems([
      { ...teamCard(), handle: "b", name: "Banner", category: "Marketing" },
      teamCard(),
    ]);
    expect(items.map((item) => item.key)).toEqual(["block:b", "block:team_card"]);
    expect(items[1]).toMatchObject({
      group: "blocks",
      kind: "elements",
      description: "Team: A person with their role",
    });
  });

  it("draws each instance as the block's design with its values", () => {
    const block = teamCard();
    const page = pageWith([instance("one", { name: "Ada" }), instance("two", { name: "Grace" })]);
    const { html } = renderPage(page, standardRegistry, { data: { blocks: { team_card: block } } });
    expect(html).toContain("Ada");
    expect(html).toContain("Grace");
    expect(html.match(/What you do/g)).toHaveLength(2);
    const changed = { ...block, design: { ...(block.design as PageNode), name: "Person" } };
    const { css } = renderPage(page, standardRegistry, {
      data: { blocks: { team_card: changed } },
    });
    expect(css).toContain("person");
  });

  it("marks only the instance as selectable on the canvas, so its design is locked", () => {
    const page = pageWith([instance("one", { name: "Ada" })]);
    const { html } = renderPage(page, standardRegistry, {
      mode: "canvas",
      data: { blocks: { team_card: teamCard() } },
    });
    // The page itself and the instance; nothing inside the instance.
    expect(html.match(/data-lintel-node=/g)).toHaveLength(2);
    expect(html).toContain('data-lintel-node="one"');
    expect(html).not.toContain("data-lintel-text");
    const missing = renderPage(page, standardRegistry, { mode: "canvas", data: { blocks: {} } });
    expect(missing.html).toContain('data-lintel-placeholder="block"');
    expect(renderPage(page, standardRegistry, { data: { blocks: {} } }).html).toBe(
      '<div class="page"></div>',
    );
  });

  it("inserts an instance from Insert and fills it in from the panel", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith([]), { library: [teamCard()], canManage: false });
    await user.click(screen.getByRole("button", { name: "Add elements" }));
    await user.click(screen.getByRole("button", { name: "Team card" }));
    const added = latest().root.children[0];
    expect(added).toMatchObject({ type: "customBlock", props: { block: "team_card", values: {} } });

    const panel = screen.getByRole("complementary", { name: "Selected element" });
    expect(within(panel).getByRole("heading", { name: "Team card component" })).toBeInTheDocument();
    expect(within(panel).queryByRole("tab", { name: "Style" })).not.toBeInTheDocument();
    await user.type(within(panel).getByLabelText("Name"), "Ada");
    expect(latest().root.children[0]?.props.values).toEqual({ name: "Ada" });
  });

  it("detaches an instance into plain elements after asking", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith([instance("one", { name: "Ada" })]), {
      library: [teamCard()],
      canManage: true,
      editDesign: vi.fn(),
    });
    await user.click(
      within(screen.getByRole("tree", { name: "Layers" })).getByRole("treeitem", {
        name: "Team card",
      }),
    );
    expect(screen.getByRole("button", { name: "Edit component design" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Detach from component" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Detach" }),
    );
    const plain = latest().root.children[0];
    expect(plain?.type).toBe("box");
    expect(plain?.children[0]?.props.text).toBe("Ada");
    expect(screen.getByRole("status")).toHaveTextContent("Detached Team card from its component");
  });

  it("makes a selection into a block and puts an instance in its place", async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (draft: NewBlockDraft) => ({
      ...teamCard(),
      name: draft.name,
      properties: draft.properties,
      design: draft.design,
    }));
    const { latest } = renderBuilder(pageWith([cardDesign()]), {
      library: [],
      canManage: true,
      create,
    });
    await user.click(
      within(screen.getByRole("tree", { name: "Layers" })).getByRole("treeitem", {
        name: "Team card",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Make into a component" }));
    const dialog = screen.getByRole("dialog", { name: "Make “Team card” into a component" });
    const nameParts = within(dialog).getAllByRole("checkbox", { name: /Words/ });
    await user.click(nameParts[0] as HTMLElement);
    await user.click(within(dialog).getByRole("button", { name: "Make component" }));
    expect(create).toHaveBeenCalledOnce();
    const draft = create.mock.calls[0]?.[0];
    expect(draft?.name).toBe("Team card");
    expect(draft?.properties.map((property) => property.handle)).toEqual(["name"]);
    expect(draft?.design.children[0]?.bindings).toEqual({ text: "name" });
    expect(latest().root.children[0]).toMatchObject({
      type: "customBlock",
      props: { block: "team_card" },
    });
  });

  it("keeps properties' settings when what editors can change is chosen again", () => {
    const block = teamCard();
    const design = block.design as PageNode;
    const withHelp = block.properties.map((property) => ({
      ...property,
      helpText: "Their full name",
    }));
    const choices = currentChoices(design, withHelp, standardCatalogue);
    expect(choices).toEqual([{ candidateId: `${design.children[0]?.id}:text`, label: "Name" }]);
    const role = findPropertyCandidates(design, standardCatalogue).find(
      (candidate) => candidate.elementName === "Role" && candidate.kind !== "visible",
    );
    const remapped = remapBlockDesign(
      design,
      [...choices, { candidateId: role?.id ?? "", label: "Role" }],
      withHelp,
      standardCatalogue,
    );
    expect(remapped.properties.map(({ handle, helpText }) => `${handle}:${helpText}`)).toEqual([
      "name:Their full name",
      "role:",
    ]);
    expect(blockBindableFields(remapped.properties)).toEqual([
      { path: "name", label: "Name", kind: "text" },
      { path: "role", label: "Role", kind: "text" },
    ]);
  });
});
