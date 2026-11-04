import {
  applyPageChanges,
  createEmptyPage,
  findNode,
  type PageChange,
  type PageDocument,
  type PageNode,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { createEditorState, editorReducer, type EditorState } from "./editor-state.js";

function element(id: string, name = ""): PageNode {
  return {
    id,
    type: "box",
    name,
    props: {},
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  };
}

function page(...children: PageNode[]): PageDocument {
  const empty = createEmptyPage();
  return { ...empty, root: { ...empty.root, children } };
}

const nameOf = (state: EditorState, id: string) => findNode(state.document.root, id)?.name;

function myChange(state: EditorState, steps: PageChange[]): EditorState {
  return editorReducer(state, {
    type: "change",
    at: 0,
    change: { label: "Changed", update: (document) => applyPageChanges(document, steps) },
  });
}

function theirChange(state: EditorState, steps: PageChange[]): EditorState {
  return editorReducer(state, {
    type: "remote",
    from: state.document,
    to: applyPageChanges(state.document, steps),
    changes: steps,
  });
}

const rename = (node: string, value: string): PageChange => ({
  op: "set",
  node,
  path: ["name"],
  value,
});

describe("undo while someone else is editing", () => {
  it("takes away only this person's change", () => {
    let state = createEditorState(page(element("a"), element("b")));
    state = myChange(state, [rename("a", "Mine")]);
    state = theirChange(state, [rename("b", "Theirs")]);
    state = editorReducer(state, { type: "undo" });
    expect(nameOf(state, "a")).toBe("");
    expect(nameOf(state, "b")).toBe("Theirs");
  });

  it("does not make someone else's change part of this person's history", () => {
    let state = createEditorState(page(element("a")));
    state = theirChange(state, [rename("a", "Theirs")]);
    expect(state.past).toHaveLength(0);
  });

  it("brings back the change on redo, with theirs still there", () => {
    let state = createEditorState(page(element("a"), element("b")));
    state = myChange(state, [rename("a", "Mine")]);
    state = editorReducer(state, { type: "undo" });
    state = theirChange(state, [rename("b", "Theirs")]);
    state = editorReducer(state, { type: "redo" });
    expect(nameOf(state, "a")).toBe("Mine");
    expect(nameOf(state, "b")).toBe("Theirs");
  });

  it("keeps an element someone else added when undoing an earlier change", () => {
    let state = createEditorState(page(element("a")));
    state = myChange(state, [rename("a", "Mine")]);
    state = theirChange(state, [
      { op: "insert", parent: "page", after: "a", node: element("new") },
    ]);
    state = editorReducer(state, { type: "undo" });
    expect(state.document.root.children.map((child) => child.id)).toEqual(["a", "new"]);
  });

  it("does not bring back what someone else removed", () => {
    let state = createEditorState(page(element("a"), element("b")));
    state = myChange(state, [rename("a", "Mine")]);
    state = theirChange(state, [{ op: "remove", node: "b" }]);
    state = editorReducer(state, { type: "undo" });
    expect(findNode(state.document.root, "b")).toBeUndefined();
  });

  it("brings back an element with what someone else did to it meanwhile", () => {
    let state = createEditorState(page(element("a")));
    state = myChange(state, [{ op: "remove", node: "a" }]);
    state = theirChange(state, [rename("a", "Theirs")]);
    state = editorReducer(state, { type: "undo" });
    expect(nameOf(state, "a")).toBe("Theirs");
  });

  it("keeps a change of this person's that hadn't been reported yet", () => {
    const start = createEditorState(page(element("a"), element("b")));
    const typed = myChange(start, [rename("a", "Still reporting")]);
    const steps = [rename("b", "Theirs")];
    const state = editorReducer(typed, {
      type: "remote",
      from: start.document,
      to: applyPageChanges(start.document, steps),
      changes: steps,
    });
    expect(nameOf(state, "a")).toBe("Still reporting");
    expect(nameOf(state, "b")).toBe("Theirs");
  });
});
