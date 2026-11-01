/**
 * Undo and redo for the studio, as a pure reducer so it can be tested without React.
 *
 * Dragging a keyframe or a slider sends many changes; giving them the same `mergeKey`
 * folds them into one step, so one undo puts back where the drag started.
 */

export interface History<Value> {
  past: Value[];
  present: Value;
  future: Value[];
  /** The merge key of the last change; cleared by undo, redo and `checkpoint`. */
  lastMergeKey: string | undefined;
}

export type HistoryAction<Value> =
  | { type: "change"; value: Value; mergeKey?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "checkpoint" }
  | { type: "replaceAll"; value: Value };

/** Enough for any editing session, without keeping every drag frame forever. */
const longestHistory = 100;

export function startHistory<Value>(value: Value): History<Value> {
  return { past: [], present: value, future: [], lastMergeKey: undefined };
}

export function historyReducer<Value>(
  history: History<Value>,
  action: HistoryAction<Value>,
): History<Value> {
  switch (action.type) {
    case "change": {
      if (Object.is(action.value, history.present)) return history;
      const merges = action.mergeKey !== undefined && action.mergeKey === history.lastMergeKey;
      return {
        past: merges ? history.past : [...history.past, history.present].slice(-longestHistory),
        present: action.value,
        future: [],
        lastMergeKey: action.mergeKey,
      };
    }
    case "undo": {
      const previous = history.past.at(-1);
      if (previous === undefined) return history;
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
        lastMergeKey: undefined,
      };
    }
    case "redo": {
      const [next, ...rest] = history.future;
      if (next === undefined) return history;
      return {
        past: [...history.past, history.present],
        present: next,
        future: rest,
        lastMergeKey: undefined,
      };
    }
    case "checkpoint":
      return { ...history, lastMergeKey: undefined };
    case "replaceAll":
      return startHistory(action.value);
  }
}
