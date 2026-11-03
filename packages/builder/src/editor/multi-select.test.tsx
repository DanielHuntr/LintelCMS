import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NewBlockDraft } from "../blocks/blocks-context.js";
import { builderStrings } from "../i18n/builder-strings.js";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import type { CommandContext } from "./commands.js";
import {
  changeStylesOfMany,
  duplicateMany,
  extendSelection,
  groupIntoBox,
  moveManyTogether,
  removeMany,
  selectionAfterClick,
  selectSiblings,
  sharedLook,
} from "./multi-selection.js";

/** Four project rows on a page, each a title and a year. */
function rows(): PageNode[] {
  return ["Harbour lights", "Paper cranes", "North wind", "Salt and stone"].map((title, index) =>
    createNode(
      {
        type: "box",
        name: "Project",
        styles: {
          base: {
            paddingTop: index === 3 ? "20px" : "8px",
            width: index === 3 ? "50%" : "100%",
            color: "#111111",
          },
        },
        children: [
          { type: "heading", name: "Project title", props: { text: title, level: 3 } },
          { type: "text", name: "Year", props: { text: String(2020 + index) } },
        ],
      },
      standardCatalogue,
      createCountingNodeIds(`r${index}-`),
    ),
  );
}

function pageWith(children: PageNode[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

function text(key: string, values?: Readonly<Record<string, string | number>>): string {
  let message: string = builderStrings[key as keyof typeof builderStrings] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replace(`{${name}}`, String(value));
  }
  return message;
}

function contextFor(document: PageDocument): CommandContext {
  return {
    document,
    selectedId: null,
    catalogue: standardCatalogue,
    createId: createCountingNodeIds("x"),
    text,
  };
}

function apply(document: PageDocument, result: ReturnType<typeof removeMany>): PageDocument {
  if ("refused" in result) throw new Error(result.refused);
  return result.change.update(document);
}

describe("choosing several", () => {
  const root = pageWith(rows()).root;
  const [a, b, c, d] = root.children.map((row) => row.id) as [string, string, string, string];

  it("adds and takes away with Ctrl or Cmd, and selects a range with Shift", () => {
    expect(selectionAfterClick(root, [a], c, "toggle")).toEqual([a, c]);
    expect(selectionAfterClick(root, [a, c], c, "toggle")).toEqual([a]);
    expect(selectionAfterClick(root, [b], d, "range")).toEqual([b, c, d]);
    expect(selectionAfterClick(root, [c], a, "range")).toEqual([c, a, b]);
    expect(selectionAfterClick(root, [a, c], b, "only")).toEqual([b]);
  });

  it("selects everything beside it, and extends one at a time", () => {
    expect(selectSiblings(root, b)).toEqual([b, a, c, d]);
    expect(extendSelection(root, [a], "next")).toEqual([a, b]);
    expect(extendSelection(root, [a, b], "previous")).toEqual([a]);
    expect(extendSelection(root, [d], "next")).toEqual([d]);
  });

  it("shows only the values they share, and says which differ", () => {
    const look = sharedLook(root.children);
    expect(look.styles.base).toEqual({ color: "#111111" });
    expect([...look.mixed]).toEqual(["paddingTop", "width"]);
  });
});

describe("changing several at once", () => {
  const document = pageWith(rows());
  const ids = document.root.children.map((row) => row.id);

  it("changes a style on all of them as one step", () => {
    const result = changeStylesOfMany(
      contextFor(document),
      ids,
      "base",
      { paddingTop: "4px" },
      "Padding",
    );
    if ("refused" in result) throw new Error(result.refused);
    expect(result.change.label).toBe("Changed Padding on 4");
    const after = result.change.update(document);
    expect(after.root.children.every((row) => row.styles.base.paddingTop === "4px")).toBe(true);
  });

  it("duplicates, deletes, groups and moves them together", () => {
    const two = ids.slice(1, 3);
    expect(apply(document, duplicateMany(contextFor(document), two)).root.children).toHaveLength(6);
    expect(apply(document, removeMany(contextFor(document), two)).root.children).toHaveLength(2);
    const grouped = apply(
      document,
      groupIntoBox(contextFor(document), [ids[2] as string, ids[1] as string]),
    );
    expect(grouped.root.children).toHaveLength(3);
    expect(grouped.root.children[1]?.children.map((child) => child.id)).toEqual(two);
    const moved = apply(document, moveManyTogether(contextFor(document), two, "up"));
    expect(moved.root.children.map((row) => row.id)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
    expect("refused" in moveManyTogether(contextFor(document), [ids[0] as string], "up")).toBe(
      true,
    );
  });

  it("won't change several when one is locked", () => {
    const locked = pageWith(
      rows().map((row, index) => (index === 1 ? { ...row, locked: true } : row)),
    );
    const result = removeMany(
      contextFor(locked),
      locked.root.children.map((row) => row.id),
    );
    expect("refused" in result && result.refused).toMatch(/locked/);
  });
});

function renderBuilder(document: PageDocument, create?: (draft: NewBlockDraft) => Promise<never>) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Work"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      blocks={create ? { library: [], canManage: true, create } : undefined}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes" })}
    />,
  );
  return { latest: () => onChange.mock.lastCall?.[0] as PageDocument };
}

const layers = () => within(screen.getByRole("tree", { name: "Layers" }));
const projectRows = () => layers().getAllByRole("treeitem", { name: "Project" });

function canvasSays(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: document.querySelector("iframe")?.contentWindow ?? null,
        data,
      }),
    );
  });
}

describe("several selected in the builder", () => {
  it("selects several in Layers with Ctrl-click, Shift-click and Ctrl+A", async () => {
    const user = userEvent.setup();
    renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Control>}");
    await user.click(projectRows()[2] as HTMLElement);
    await user.keyboard("{/Control}");
    expect(projectRows().map((row) => row.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "true",
      "false",
    ]);
    expect(screen.getByRole("heading", { name: "2 selected" })).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "Layers" })).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );

    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Shift>}");
    await user.click(projectRows()[3] as HTMLElement);
    await user.keyboard("{/Shift}");
    expect(screen.getByRole("heading", { name: "4 selected" })).toBeInTheDocument();

    await user.click(projectRows()[1] as HTMLElement);
    expect(screen.queryByRole("heading", { name: /selected$/ })).not.toBeInTheDocument();
    await user.keyboard("{Control>}a{/Control}");
    expect(screen.getByRole("heading", { name: "4 selected" })).toBeInTheDocument();
  });

  // Clicking the first of several kept them all, and they came back after clicking elsewhere.
  it("goes back to one with a plain click, on any of them", async () => {
    const user = userEvent.setup();
    const document = pageWith(rows());
    renderBuilder(document);
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(projectRows()[0] as HTMLElement);
    expect(screen.queryByRole("heading", { name: /selected$/ })).not.toBeInTheDocument();

    await user.keyboard("{Control>}a{/Control}");
    await user.click(projectRows()[1] as HTMLElement);
    await user.click(projectRows()[0] as HTMLElement);
    expect(screen.queryByRole("heading", { name: /selected$/ })).not.toBeInTheDocument();

    await user.keyboard("{Control>}a{/Control}");
    canvasSays({ type: "select", nodeId: document.root.children[0]?.id });
    expect(screen.queryByRole("heading", { name: /selected$/ })).not.toBeInTheDocument();
  });

  it("extends the selection with Shift and the arrows", async () => {
    const user = userEvent.setup();
    renderBuilder(pageWith(rows()));
    await user.click(projectRows()[1] as HTMLElement);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(screen.getByRole("heading", { name: "2 selected" })).toBeInTheDocument();
  });

  it("adds to the selection with Shift-click on the canvas, with one label", () => {
    const document = pageWith(rows());
    renderBuilder(document);
    const [first, second, third] = document.root.children;
    canvasSays({ type: "select", nodeId: first?.id });
    canvasSays({ type: "select", nodeId: second?.id, add: true });
    canvasSays({ type: "select", nodeId: third?.id, add: true });
    expect(screen.getByRole("heading", { name: "3 selected" })).toBeInTheDocument();
    canvasSays({ type: "select", nodeId: second?.id, add: true });
    expect(screen.getByRole("heading", { name: "2 selected" })).toBeInTheDocument();
  });

  it("changes a style on all of them in one Undo, showing Mixed where they differ", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Control>}a{/Control}");
    const panel = screen.getByRole("complementary", { name: "Selected element" });
    await user.click(within(panel).getByRole("radio", { name: "Advanced" }));
    const sizeSection = within(panel)
      .getAllByRole("button")
      .find(
        (button) =>
          button.hasAttribute("aria-expanded") &&
          !button.hasAttribute("aria-haspopup") &&
          button.textContent?.startsWith("Size"),
      ) as HTMLElement;
    if (sizeSection.getAttribute("aria-expanded") !== "true") await user.click(sizeSection);
    const width = within(panel).getByRole("textbox", { name: "Width" });
    expect(width).toHaveAttribute("placeholder", "Mixed");
    await user.type(width, "80%{Enter}");
    expect(latest().root.children.every((row) => row.styles.base.width === "80%")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Undo: Changed Width on 4" }));
    expect(latest().root.children.map((row) => row.styles.base.width)).toEqual([
      "100%",
      "100%",
      "100%",
      "50%",
    ]);
  });

  it("asks to select one for words, and puts the same motion on all", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("tab", { name: "Content" }));
    expect(screen.getByText("Select one to edit its words.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Appears" }));
    expect(latest().root.children.every((row) => row.animations?.[0]?.presetId === "fade-up")).toBe(
      true,
    );
  });

  it("makes the selected rows one component, each keeping its words", async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (draft: NewBlockDraft) => ({
      handle: "project",
      name: draft.name,
      icon: "square",
      category: "",
      description: "",
      source: "site" as const,
      properties: draft.properties,
      design: draft.design,
      template: null,
      renamedProperties: {},
    }));
    const { latest } = renderBuilder(pageWith(rows()), create as never);
    await user.click(projectRows()[1] as HTMLElement);
    await user.keyboard("{Control>}");
    await user.click(projectRows()[3] as HTMLElement);
    await user.keyboard("{/Control}");
    await user.click(screen.getByRole("button", { name: "Make these 2 one component" }));
    const dialog = screen.getByRole("dialog", { name: "Make these 2 one component" });
    await user.click(within(dialog).getByRole("button", { name: "Make component" }));
    const after = latest().root.children;
    expect(after.map((row) => row.type)).toEqual(["box", "customBlock", "box", "customBlock"]);
    expect(after[3]?.props.values).toMatchObject({ project_title: "Salt and stone" });
  });

  it("keeps a client to one element at a time", () => {
    const document = pageWith(rows());
    const onChange = vi.fn<(next: PageDocument) => void>();
    render(
      <PageBuilder
        initialDocument={document}
        onChange={onChange}
        title="Work"
        canEditCode={false}
        contentOnly
        createId={createCountingNodeIds("new")}
        preferences={createMemoryPreferenceStore({ tourSeen: "yes", clientTourSeen: "yes" })}
      />,
    );
    const [first, second] = document.root.children;
    canvasSays({ type: "select", nodeId: first?.children[0]?.id });
    canvasSays({ type: "select", nodeId: second?.children[0]?.id, add: true });
    expect(screen.queryByText(/\d selected/)).not.toBeInTheDocument();
    expect(screen.queryByRole("tree", { name: "Layers" })).not.toBeInTheDocument();
  });

  it("changes the layout of all of them as one step", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Control>}a{/Control}");
    const panel = screen.getByRole("complementary", { name: "Selected element" });
    await user.click(within(panel).getByRole("radio", { name: "Anywhere" }));
    expect(latest().root.children.every((row) => row.freeLayout !== undefined)).toBe(true);
    await user.click(screen.getByRole("button", { name: /^Undo: Changed the layout of 4/ }));
    expect(latest().root.children.every((row) => row.freeLayout === undefined)).toBe(true);
  });

  it("deletes all of them with Delete, as one step", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(latest().root.children).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Deleted 2 elements");
  });
});
