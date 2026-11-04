import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  type PageNode,
  rootNodeId,
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
  moveManyTo,
  moveManyTogether,
  outermostInPageOrder,
  removeMany,
  selectionAfterClick,
  selectSiblings,
  sharedLook,
  toggleHiddenOfMany,
  toggleLockedOfMany,
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

function pressOnCanvas(key: string, shiftKey = false) {
  canvasSays({
    type: "key",
    key: { key, ctrlKey: true, metaKey: true, shiftKey, altKey: false },
  });
}

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

describe("hiding, locking and moving several", () => {
  const document = pageWith(rows());
  const ids = document.root.children.map((row) => row.id);
  const [a = "", b = "", c = "", d = ""] = ids;
  const order = (next: PageDocument) => next.root.children.map((row) => ids.indexOf(row.id));

  it("hides all of them, then shows them all, as one step each", () => {
    const hidden = apply(document, toggleHiddenOfMany(contextFor(document), [a, b]));
    expect(hidden.root.children.map((row) => Boolean(row.hidden))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    const shown = apply(hidden, toggleHiddenOfMany(contextFor(hidden), [a, b]));
    expect(shown.root.children.every((row) => !row.hidden)).toBe(true);
  });

  it("hides all of them when only some are hidden", () => {
    const one = apply(document, toggleHiddenOfMany(contextFor(document), [a, b]));
    const all = apply(one, toggleHiddenOfMany(contextFor(one), [a, b, c]));
    expect(all.root.children.slice(0, 3).every((row) => row.hidden)).toBe(true);
  });

  it("locks all of them, and unlocks them even though they're locked", () => {
    const locked = apply(document, toggleLockedOfMany(contextFor(document), [a, b]));
    expect(locked.root.children.slice(0, 2).every((row) => row.locked)).toBe(true);
    const unlocked = apply(locked, toggleLockedOfMany(contextFor(locked), [a, b]));
    expect(unlocked.root.children.every((row) => !row.locked)).toBe(true);
  });

  it("moves all of them to one place, side by side in page order", () => {
    const root = rootNodeId;
    // Selected last to first; the end of the page.
    expect(order(apply(document, moveManyTo(contextFor(document), [b, a], root, 4)))).toEqual([
      2, 3, 0, 1,
    ]);
    // Between two others, with one of them before the place and one after.
    expect(order(apply(document, moveManyTo(contextFor(document), [a, d], root, 2)))).toEqual([
      1, 0, 3, 2,
    ]);
    expect(order(apply(document, moveManyTo(contextFor(document), [c, d], root, 0)))).toEqual([
      2, 3, 0, 1,
    ]);
  });

  it("moves them into another element, bringing what's inside them", () => {
    const next = apply(document, moveManyTo(contextFor(document), [a, b], d, 0));
    const target = next.root.children.at(-1);
    expect(next.root.children).toHaveLength(2);
    expect(target?.children.slice(0, 2).map((row) => row.id)).toEqual([a, b]);
  });

  it("won't move them inside one of themselves, or past a locked one", () => {
    const inside = moveManyTo(contextFor(document), [a, b], b, 0);
    expect("refused" in inside && inside.refused).toMatch(/inside itself/);
    const locked = apply(document, toggleLockedOfMany(contextFor(document), [a]));
    const result = moveManyTo(contextFor(locked), [a, b], rootNodeId, 4);
    expect("refused" in result && result.refused).toMatch(/locked/);
  });

  it("leaves out an element inside another selected one, and keeps page order", () => {
    const child = document.root.children[1]?.children[0]?.id ?? "";
    const taken = outermostInPageOrder(document.root, [c, child, b]);
    expect(taken.map((node) => node.id)).toEqual([b, c]);
  });
});

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

  it("hides, locks, copies and cuts all of them from the keyboard, one Undo each", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    const firstTwo = () => latest().root.children.slice(0, 2);

    pressOnCanvas("h", true);
    expect(firstTwo().every((row) => row.hidden)).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Hid 2 elements");
    pressOnCanvas("z");
    expect(firstTwo().every((row) => !row.hidden)).toBe(true);

    pressOnCanvas("l", true);
    expect(firstTwo().every((row) => row.locked)).toBe(true);
    pressOnCanvas("z");
    expect(firstTwo().every((row) => !row.locked)).toBe(true);

    pressOnCanvas("c");
    expect(screen.getByRole("status")).toHaveTextContent("Copied 2 elements");
    pressOnCanvas("x");
    expect(latest().root.children).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Cut 2 elements");
    canvasSays({ type: "paste", html: "", text: "" });
    expect(latest().root.children).toHaveLength(4);
    pressOnCanvas("z");
    pressOnCanvas("z");
    expect(latest().root.children).toHaveLength(4);
    expect(latest().root.children[0]?.children[0]?.props.text).toBe("Harbour lights");
  });

  it("pastes several after the last selected, in order, and selects them all (LINTEL-UX-288)", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    pressOnCanvas("c");

    canvasSays({ type: "paste", html: "", text: "" });

    const titles = latest().root.children.map((row) => row.children[0]?.props.text);
    expect(titles).toEqual([
      "Harbour lights",
      "Paper cranes",
      "Harbour lights",
      "Paper cranes",
      "North wind",
      "Salt and stone",
    ]);
    const selected = projectRows().map((row) => row.getAttribute("aria-selected"));
    expect(selected).toEqual(["false", "false", "true", "true", "false", "false"]);
    pressOnCanvas("z");
    expect(latest().root.children).toHaveLength(4);
  });

  it("selects all of a group pasted into the one element selected", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    pressOnCanvas("c");
    await user.click(projectRows()[3] as HTMLElement);

    canvasSays({ type: "paste", html: "", text: "" });

    expect(latest().root.children).toHaveLength(4);
    expect(
      latest()
        .root.children[3]?.children.map((child) => child.type)
        .slice(-2),
    ).toEqual(["box", "box"]);
    const selected = layers()
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(2);
  });

  it("hides all of them from any of their rows in Layers", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(pageWith(rows()));
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    const second = projectRows()[1] as HTMLElement;
    await user.click(within(second).getByRole("button", { name: /^Hide/ }));
    expect(
      latest()
        .root.children.slice(0, 2)
        .every((row) => row.hidden),
    ).toBe(true);
    expect(latest().root.children[2]?.hidden).toBeFalsy();
  });

  it("moves all of them when one is dragged on the canvas, keeping them selected", async () => {
    const user = userEvent.setup();
    const document = pageWith(rows());
    const { latest } = renderBuilder(document);
    await user.click(projectRows()[0] as HTMLElement);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    const [first, second, , last] = document.root.children;
    canvasSays({
      type: "moveOver",
      nodeId: second?.id,
      chain: [{ nodeId: last?.id, ratio: 0.95, across: false }],
    });
    canvasSays({ type: "moveDrop", nodeId: second?.id });
    expect(
      latest()
        .root.children.slice(-2)
        .map((row) => row.id),
    ).toEqual([first?.id, second?.id]);
    expect(screen.getByRole("heading", { name: "2 selected" })).toBeInTheDocument();
  });

  it("offers only what different kinds share in Style", async () => {
    const user = userEvent.setup();
    const picture = createNode(
      { type: "image", name: "Picture", props: { src: "/a.jpg", alt: "A boat" } },
      standardCatalogue,
      createCountingNodeIds("p"),
    );
    const words = createNode(
      { type: "text", name: "Words", props: { text: "Hello" } },
      standardCatalogue,
      createCountingNodeIds("w"),
    );
    renderBuilder(pageWith([picture, words]));
    const row = (name: string) => layers().getByRole("treeitem", { name });
    await user.click(row("Picture"));
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(screen.getByRole("heading", { name: "2 selected" })).toBeInTheDocument();
    expect(screen.getByText(/Only what they have in common shows/)).toBeInTheDocument();
    const styleButtons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(styleButtons).toContain("Spacing");
    expect(styleButtons).not.toContain("Text");
    expect(styleButtons).not.toContain("Layout");
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
