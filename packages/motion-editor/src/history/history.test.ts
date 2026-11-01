import { describe, expect, it } from "vitest";
import { historyReducer, startHistory } from "./history.js";

describe("undo and redo", () => {
  it("steps back and forward through changes", () => {
    let history = startHistory(1);
    history = historyReducer(history, { type: "change", value: 2 });
    history = historyReducer(history, { type: "change", value: 3 });
    history = historyReducer(history, { type: "undo" });
    expect(history.present).toBe(2);
    history = historyReducer(history, { type: "redo" });
    expect(history.present).toBe(3);
  });

  it("forgets the redo trail after a new change", () => {
    let history = historyReducer(startHistory("a"), { type: "change", value: "b" });
    history = historyReducer(history, { type: "undo" });
    history = historyReducer(history, { type: "change", value: "c" });
    expect(history.future).toEqual([]);
    expect(history.past).toEqual(["a"]);
  });

  it("folds a drag into one step, until a checkpoint", () => {
    let history = startHistory(0);
    for (const value of [1, 2, 3])
      history = historyReducer(history, { type: "change", value, mergeKey: "drag" });
    expect(history.past).toEqual([0]);
    history = historyReducer(history, { type: "checkpoint" });
    history = historyReducer(history, { type: "change", value: 4, mergeKey: "drag" });
    expect(history.past).toEqual([0, 3]);
  });

  it("ignores undo with nothing to undo, and changes to the same value", () => {
    const history = startHistory({ size: 1 });
    expect(historyReducer(history, { type: "undo" })).toBe(history);
    expect(historyReducer(history, { type: "change", value: history.present })).toBe(history);
  });
});
