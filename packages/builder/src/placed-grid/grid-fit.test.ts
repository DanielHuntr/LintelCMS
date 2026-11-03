import { describe, expect, it } from "vitest";
import { fitToGrid, type GridFitInput } from "./grid-fit.js";

// Twelve 60px columns with 20px gaps (940px wide), and two 100px rows with 20px gaps.
const grid: Omit<GridFitInput, "box" | "mode"> = {
  columns: Array.from({ length: 12 }, () => "60px").join(" "),
  rows: "100px 100px",
  columnGap: 20,
  rowGap: 20,
  minRow: 48,
};

describe("fitting to a placed grid", () => {
  it("reads where an element sits now", () => {
    const fit = fitToGrid({
      ...grid,
      mode: "fit",
      box: { left: 80, top: 0, width: 380, height: 220 },
    });
    expect(fit).toMatchObject({ column: 2, columnSpan: 5, row: 1, rowSpan: 2 });
    expect(fit?.area).toEqual({ left: 80, top: 0, width: 380, height: 220 });
    expect(fit?.columnAreas).toHaveLength(12);
  });

  it("moves to the nearest lines, keeping the spans and staying on the grid", () => {
    const keep = { column: 2, row: 1, columnSpan: 5, rowSpan: 1 };
    expect(
      fitToGrid({
        ...grid,
        mode: "move",
        keep,
        box: { left: 410, top: 112, width: 380, height: 90 },
      }),
    ).toMatchObject({ column: 6, columnSpan: 5, row: 2, rowSpan: 1 });
    // Dragged off the right-hand side: the last place it fits.
    expect(
      fitToGrid({
        ...grid,
        mode: "move",
        keep,
        box: { left: 900, top: 0, width: 380, height: 90 },
      }),
    ).toMatchObject({ column: 8, columnSpan: 5 });
  });

  it("adds rows below the last one, so things can go under everything else", () => {
    const fit = fitToGrid({
      ...grid,
      mode: "move",
      keep: { column: 1, row: 1, columnSpan: 3, rowSpan: 2 },
      box: { left: 0, top: 245, width: 220, height: 90 },
    });
    expect(fit).toMatchObject({ row: 3, rowSpan: 2 });
    expect(fit?.area.top).toBe(240);
    expect(fit?.area.height).toBe(48 + 20 + 48);
  });

  it("resizes from a fixed start to the nearest end", () => {
    const fit = fitToGrid({
      ...grid,
      mode: "resize",
      keep: { column: 3, row: 1, columnSpan: 1, rowSpan: 1 },
      box: { left: 160, top: 0, width: 300, height: 200 },
    });
    expect(fit).toMatchObject({ column: 3, columnSpan: 4, row: 1, rowSpan: 2 });
    // Never smaller than one cell.
    expect(
      fitToGrid({
        ...grid,
        mode: "resize",
        keep: { column: 3, row: 1, columnSpan: 4, rowSpan: 1 },
        box: { left: 160, top: 0, width: -50, height: 5 },
      }),
    ).toMatchObject({ column: 3, columnSpan: 1, rowSpan: 1 });
  });

  it("gives nothing for something that isn't a grid", () => {
    expect(
      fitToGrid({
        ...grid,
        columns: "none",
        mode: "fit",
        box: { left: 0, top: 0, width: 1, height: 1 },
      }),
    ).toBeNull();
  });
});
