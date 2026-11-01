import type { PageDocument } from "@lintel/builder-model";

/**
 * The builder's state that undo covers: the page and the selection, with the history of
 * changes. Hover, the screen size being edited and open panels are not part of it; undo
 * only ever changes the page.
 *
 * Every change has a plain label ("Changed padding", "Added Heading") for the History panel
 * and for screen readers. Quick runs of the same change (typing, dragging a slider) with
 * the same `coalesceKey` are merged into one step, so undo doesn't go letter by letter.
 */

export interface HistoryStep {
  label: string;
  /** The page before this change. */
  before: PageDocument;
}

export interface EditorState {
  document: PageDocument;
  selectedId: string | null;
  /** Changes made, oldest first. */
  past: HistoryStep[];
  /** Changes undone, most recently undone last. */
  future: Array<{ label: string; after: PageDocument }>;
  lastChange: { coalesceKey: string; at: number } | null;
}

export interface PageChange {
  label: string;
  update: (document: PageDocument) => PageDocument;
  /** What to select afterwards. Undefined keeps the selection. */
  select?: string | null;
  coalesceKey?: string;
}

export type EditorAction =
  | { type: "change"; change: PageChange; at: number }
  | { type: "undo" }
  | { type: "redo" }
  /** Goes back to just after the change at `index` in `past`; -1 is before any change. */
  | { type: "goToStep"; index: number }
  | { type: "select"; nodeId: string | null }
  | { type: "load"; document: PageDocument };

export const historyLimit = 200;
/** Changes with the same key closer together than this become one step. */
export const coalesceWindowMs = 1000;

export function createEditorState(document: PageDocument): EditorState {
  return { document, selectedId: null, past: [], future: [], lastChange: null };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "change":
      return applyChange(state, action.change, action.at);
    case "undo":
      return undo(state);
    case "redo":
      return redo(state);
    case "goToStep":
      return goToStep(state, action.index);
    case "select":
      return state.selectedId === action.nodeId ? state : { ...state, selectedId: action.nodeId };
    case "load":
      return createEditorState(action.document);
  }
}

function applyChange(state: EditorState, change: PageChange, at: number): EditorState {
  const document = change.update(state.document);
  if (document === state.document) return state;
  const selectedId = change.select === undefined ? state.selectedId : change.select;
  const merges =
    change.coalesceKey !== undefined &&
    state.lastChange?.coalesceKey === change.coalesceKey &&
    at - state.lastChange.at < coalesceWindowMs &&
    state.past.length > 0;

  const past = merges
    ? [
        ...state.past.slice(0, -1),
        { label: change.label, before: (state.past.at(-1) as HistoryStep).before },
      ]
    : [...state.past, { label: change.label, before: state.document }].slice(-historyLimit);
  return {
    document,
    selectedId,
    past,
    future: [],
    lastChange: change.coalesceKey === undefined ? null : { coalesceKey: change.coalesceKey, at },
  };
}

function undo(state: EditorState): EditorState {
  const step = state.past.at(-1);
  if (!step) return state;
  return {
    ...state,
    document: step.before,
    past: state.past.slice(0, -1),
    future: [...state.future, { label: step.label, after: state.document }],
    lastChange: null,
  };
}

function redo(state: EditorState): EditorState {
  const step = state.future.at(-1);
  if (!step) return state;
  return {
    ...state,
    document: step.after,
    past: [...state.past, { label: step.label, before: state.document }],
    future: state.future.slice(0, -1),
    lastChange: null,
  };
}

function goToStep(state: EditorState, index: number): EditorState {
  let next = state;
  const target = Math.max(-1, Math.min(index, state.past.length + state.future.length - 1));
  while (next.past.length - 1 > target) next = undo(next);
  while (next.past.length - 1 < target && next.future.length > 0) next = redo(next);
  return next;
}

/** The label of what undo would undo, and redo would redo, for menus and announcements. */
export function describeUndo(state: EditorState): { undo?: string; redo?: string } {
  return { undo: state.past.at(-1)?.label, redo: state.future.at(-1)?.label };
}
