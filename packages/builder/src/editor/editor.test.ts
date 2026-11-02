import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { englishText } from "../i18n/builder-text.js";
import { choosePasteSource } from "./clipboard.js";
import * as commands from "./commands.js";
import {
  createEditorState,
  editorReducer,
  type EditorState,
  type PageChange,
} from "./editor-state.js";
import { shortcutFor } from "./shortcuts.js";
import { simpleHero } from "../testing/simple-hero.js";

function heroPage(): PageDocument {
  const page = createEmptyPage();
  const hero = createNode(simpleHero, standardCatalogue, createCountingNodeIds());
  return { ...page, root: { ...page.root, children: [hero] } };
}

// n1 section "Hero" > n2 container > n3 heading, n4 paragraph, n5 button
const context = (
  document: PageDocument,
  selectedId: string | null = null,
): commands.CommandContext => ({
  document,
  selectedId,
  catalogue: standardCatalogue,
  createId: createCountingNodeIds("new"),
  text: englishText,
});

function apply(state: EditorState, result: commands.CommandResult, at = 0): EditorState {
  if ("refused" in result) throw new Error(result.refused);
  return editorReducer(state, { type: "change", change: result.change, at });
}

const childIds = (document: PageDocument, nodeId: string) =>
  findNode(document.root, nodeId)?.children.map((child) => child.id);

describe("the editor’s history", () => {
  const rename = (name: string, coalesceKey?: string): PageChange => ({
    label: `Renamed to ${name}`,
    update: (document) => ({ ...document, root: { ...document.root, name } }),
    coalesceKey,
  });

  it("undoes and redoes changes, with their labels", () => {
    let state = createEditorState(createEmptyPage());
    state = editorReducer(state, { type: "change", change: rename("A"), at: 0 });
    state = editorReducer(state, { type: "change", change: rename("B"), at: 0 });
    expect(state.past.map((step) => step.label)).toEqual(["Renamed to A", "Renamed to B"]);
    state = editorReducer(state, { type: "undo" });
    expect(state.document.root.name).toBe("A");
    expect(state.future.map((step) => step.label)).toEqual(["Renamed to B"]);
    state = editorReducer(state, { type: "redo" });
    expect(state.document.root.name).toBe("B");
    state = editorReducer(state, { type: "goToStep", index: -1 });
    expect(state.document.root.name).toBe("");
    expect(state.future).toHaveLength(2);
  });

  it("merges quick changes with the same key into one step", () => {
    let state = createEditorState(createEmptyPage());
    state = editorReducer(state, { type: "change", change: rename("H", "typing"), at: 0 });
    state = editorReducer(state, { type: "change", change: rename("Hi", "typing"), at: 400 });
    state = editorReducer(state, { type: "change", change: rename("Hi!", "typing"), at: 3000 });
    expect(state.past).toHaveLength(2);
    expect(editorReducer(state, { type: "undo" }).document.root.name).toBe("Hi");
  });

  it("ignores changes that change nothing", () => {
    const state = createEditorState(createEmptyPage());
    const same = editorReducer(state, {
      type: "change",
      change: { label: "x", update: (document) => document },
      at: 0,
    });
    expect(same).toBe(state);
  });
});

describe("builder commands", () => {
  it("adds inside a selected container, or after a selected element", () => {
    const page = heroPage();
    const inside = apply(
      createEditorState(page),
      commands.insertBlueprint(context(page, "n2"), { type: "divider" }),
    );
    expect(childIds(inside.document, "n2")).toEqual(["n3", "n4", "n5", "new1"]);
    expect(inside.selectedId).toBe("new1");
    const after = apply(
      createEditorState(page),
      commands.insertBlueprint(context(page, "n3"), { type: "text" }),
    );
    expect(childIds(after.document, "n2")).toEqual(["n3", "new1", "n4", "n5"]);
    const nothingSelected = apply(
      createEditorState(page),
      commands.insertBlueprint(context(page), { type: "section" }),
    );
    expect(childIds(nothingSelected.document, "page")).toEqual(["n1", "new1"]);
  });

  it("puts a Header at the top of the page and a Footer at the bottom, whatever is selected", () => {
    const page = heroPage();
    const header = apply(
      createEditorState(page),
      commands.insertBlueprint(context(page, "n4"), { type: "siteHeader" }),
    );
    expect(childIds(header.document, "page")).toEqual(["new1", "n1"]);
    expect(childIds(header.document, "n2")).toEqual(["n3", "n4", "n5"]);
    const footer = apply(
      createEditorState(page),
      commands.insertBlueprint(context(page, "n3"), { type: "siteFooter" }),
    );
    expect(childIds(footer.document, "page")).toEqual(["n1", "new1"]);
    // The footer templates are sections drawn as the page's footer.
    const footerSection = apply(
      createEditorState(header.document),
      commands.insertBlueprint(context(header.document, "n3"), {
        type: "section",
        props: { element: "footer" },
      }),
    );
    const order = footerSection.document.root.children.map((child) => child.type);
    expect(order).toEqual(["siteHeader", "section", "section"]);
    expect(footerSection.document.root.children.at(-1)?.props.element).toBe("footer");
  });

  it("moves elements up, down, in and out, and says when it can’t", () => {
    const page = heroPage();
    const down = apply(createEditorState(page), commands.moveSelected(context(page, "n3"), "down"));
    expect(childIds(down.document, "n2")).toEqual(["n4", "n3", "n5"]);
    expect(commands.moveSelected(context(page, "n3"), "up")).toEqual({
      refused: "Hero title can’t move that way.",
    });
    const out = apply(createEditorState(page), commands.moveSelected(context(page, "n5"), "out"));
    expect(childIds(out.document, "n1")).toEqual(["n2", "n5"]);
    expect(commands.moveSelected(context(page, "n4"), "in")).toEqual({
      refused: "Paragraph can’t move that way.",
    });
  });

  it("refuses to change locked elements or anything inside them", () => {
    const page = heroPage();
    const locked = apply(
      createEditorState(page),
      commands.changeNode(context(page), "n2", "Locked", (node) => ({ ...node, locked: true })),
    );
    expect(commands.removeSelected(context(locked.document, "n3"))).toEqual({
      refused: "Hero title is locked. Unlock it in Layers to change it.",
    });
    expect(
      "refused" in
        commands.changeStyles(
          context(locked.document),
          "n3",
          "base",
          { color: "red" },
          "Text colour",
        ),
    ).toBe(true);
  });

  it("won’t put things where they can’t go", () => {
    const page = heroPage();
    expect(commands.moveTo(context(page), "n4", "n3", 0)).toEqual({
      refused: "Paragraph can’t go inside Hero title.",
    });
    expect(commands.moveTo(context(page), "n1", "n2", 0)).toEqual({
      refused: "An element can’t go inside itself.",
    });
  });

  it("duplicates with new ids and selects the copy", () => {
    const page = heroPage();
    const state = apply(createEditorState(page), commands.duplicateSelected(context(page, "n3")));
    expect(childIds(state.document, "n2")).toEqual(["n3", "new1", "n4", "n5"]);
    expect(state.selectedId).toBe("new1");
  });

  it("removes and selects the next element", () => {
    const page = heroPage();
    const state = apply(createEditorState(page), commands.removeSelected(context(page, "n3")));
    expect(childIds(state.document, "n2")).toEqual(["n4", "n5"]);
    expect(state.selectedId).toBe("n4");
  });

  it("sets styles at a screen size without touching desktop", () => {
    const page = heroPage();
    const state = apply(
      createEditorState(page),
      commands.changeStyles(context(page), "n3", "phone", { fontSize: "2rem" }, "Text size"),
    );
    const heading = findNode(state.document.root, "n3");
    expect(heading?.styles).toEqual({ base: {}, phone: { fontSize: "2rem" } });
    expect(state.past.at(-1)?.label).toBe("Changed Text size");
  });
});

describe("shortcuts", () => {
  const key = (
    name: string,
    extra: Partial<Record<"metaKey" | "ctrlKey" | "shiftKey" | "altKey", boolean>> = {},
  ) => ({
    key: name,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...extra,
  });

  it("use Cmd on a Mac and Ctrl elsewhere", () => {
    expect(shortcutFor(key("z", { metaKey: true }), true)).toBe("undo");
    expect(shortcutFor(key("Z", { metaKey: true, shiftKey: true }), true)).toBe("redo");
    expect(shortcutFor(key("z", { metaKey: true }), false)).toBeNull();
    expect(shortcutFor(key("y", { ctrlKey: true }), false)).toBe("redo");
    expect(shortcutFor(key("d", { ctrlKey: true }), false)).toBe("duplicate");
  });

  it("nudge with Alt and the arrows", () => {
    expect(shortcutFor(key("ArrowUp", { altKey: true }), true)).toBe("moveUp");
    expect(shortcutFor(key("ArrowRight", { altKey: true }), true)).toBe("moveIn");
    expect(shortcutFor(key("ArrowDown"), true)).toBe("selectNext");
    expect(shortcutFor(key("Backspace"), true)).toBe("remove");
    expect(shortcutFor(key("a"), true)).toBeNull();
  });
});

describe("pasting", () => {
  const nodes = [createNode({ type: "text" }, standardCatalogue, () => "t1")];

  it("uses the builder’s copy when the clipboard still holds it", () => {
    const clipboard = { nodes, systemText: "<p>Hi</p>" };
    expect(
      choosePasteSource(clipboard, { html: '<meta charset="utf-8"><p>Hi</p>', text: "<p>Hi</p>" }),
    ).toEqual({ kind: "builder", nodes });
  });

  it("imports newer HTML from another app", () => {
    const clipboard = { nodes, systemText: "<p>Hi</p>" };
    expect(
      choosePasteSource(clipboard, { html: "<h2>From a website</h2>", text: "From a website" }),
    ).toEqual({ kind: "html", html: "<h2>From a website</h2>" });
  });

  it("turns plain text into paragraphs", () => {
    expect(choosePasteSource(null, { html: "", text: "One\n\nTwo & three" })).toEqual({
      kind: "html",
      html: "<p>One</p><p>Two &amp; three</p>",
    });
  });
});
