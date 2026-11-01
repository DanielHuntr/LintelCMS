import { useCallback, useMemo, useReducer } from "react";
import { historyReducer, startHistory, type History, type HistoryAction } from "./history.js";

export interface HistoryControls<Value> {
  value: Value;
  change(value: Value, mergeKey?: string): void;
  undo(): void;
  redo(): void;
  /** Ends a run of merged changes, e.g. when a drag ends. */
  checkpoint(): void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory<Value>(initial: Value): HistoryControls<Value> {
  const [history, dispatch] = useReducer(
    (state: History<Value>, action: HistoryAction<Value>) => historyReducer(state, action),
    initial,
    startHistory,
  );
  const change = useCallback(
    (value: Value, mergeKey?: string) => dispatch({ type: "change", value, mergeKey }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const checkpoint = useCallback(() => dispatch({ type: "checkpoint" }), []);
  return useMemo(
    () => ({
      value: history.present,
      change,
      undo,
      redo,
      checkpoint,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [history, change, undo, redo, checkpoint],
  );
}
