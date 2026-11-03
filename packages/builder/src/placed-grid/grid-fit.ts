/**
 * Where a dragged element lands on a placed grid: the column and row lines nearest to it.
 * Moving keeps its spans and finds the nearest start; resizing keeps its start and finds the
 * nearest end; fitting finds both (it reads where an element is now). Rows past the last
 * one are counted at the grid's shortest row height, so things can be dropped below
 * everything else and the grid grows to hold them.
 *
 * Everything is in pixels from the top left of the grid's content box. The column and row
 * sizes are as the browser reports them (`getComputedStyle(grid).gridTemplateColumns`, which
 * gives each track's size, "120px 120px ...").
 *
 * Written as one self-contained function (no imports, no outside names), because the canvas
 * frame gets it as text alongside its own script (see `canvasFrameSource`).
 */

export interface GridBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GridFitInput {
  columns: string;
  rows: string;
  columnGap: number;
  rowGap: number;
  /** The shortest a row is, for the rows past the last one. */
  minRow: number;
  box: GridBox;
  mode: "move" | "resize" | "fit";
  /** Moving: the spans to keep. Resizing: the start to keep (lines counted from 1). */
  keep?: { column: number; row: number; columnSpan: number; rowSpan: number };
}

export interface GridFit {
  column: number;
  columnSpan: number;
  row: number;
  rowSpan: number;
  /** The cells it would take, for the canvas to shade. */
  area: GridBox;
  /** Each column, for the guides shown while dragging. */
  columnAreas: Array<{ left: number; width: number }>;
}

export function fitToGrid(input: GridFitInput): GridFit | null {
  const sizesOf = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .map((part) => (/^[\d.]+px$/.test(part) ? Number.parseFloat(part) : Number.NaN))
      .filter((size) => Number.isFinite(size) && size >= 0);
  const linesOf = (sizes: number[], gap: number) => {
    const starts: number[] = [];
    const ends: number[] = [];
    let at = 0;
    for (const size of sizes) {
      starts.push(at);
      ends.push(at + size);
      at += size + gap;
    }
    return { starts, ends };
  };
  const nearest = (lines: number[], value: number, from: number, to: number) => {
    let best = from;
    for (let index = from; index <= to; index += 1) {
      if (Math.abs((lines[index] ?? 0) - value) < Math.abs((lines[best] ?? 0) - value)) {
        best = index;
      }
    }
    return best;
  };

  const columnSizes = sizesOf(input.columns);
  if (columnSizes.length === 0) return null;
  const rowSizes = sizesOf(input.rows);
  const minRow = Math.max(8, input.minRow);
  const bottom = input.box.top + input.box.height;
  // Enough rows to reach below the element, so it can be dropped under everything else.
  let reach = rowSizes.reduce((total, size) => total + size + input.rowGap, 0);
  while ((reach < bottom + minRow || rowSizes.length < 1) && rowSizes.length < 200) {
    rowSizes.push(minRow);
    reach += minRow + input.rowGap;
  }
  const columns = linesOf(columnSizes, input.columnGap);
  const rows = linesOf(rowSizes, input.rowGap);
  const lastColumn = columnSizes.length - 1;
  const lastRow = rowSizes.length - 1;
  const right = input.box.left + input.box.width;

  let column: number;
  let row: number;
  let columnEnd: number;
  let rowEnd: number;
  const keep = input.keep;
  if (input.mode === "move" && keep) {
    const columnSpan = Math.min(columnSizes.length, Math.max(1, keep.columnSpan));
    column = nearest(columns.starts, input.box.left, 0, lastColumn - columnSpan + 1);
    columnEnd = column + columnSpan - 1;
    row = nearest(rows.starts, input.box.top, 0, lastRow);
    rowEnd = row + Math.max(1, keep.rowSpan) - 1;
    while (rowEnd > rows.ends.length - 1) {
      const previous = rows.ends[rows.ends.length - 1] ?? 0;
      rows.starts.push(previous + input.rowGap);
      rows.ends.push(previous + input.rowGap + minRow);
    }
  } else if (input.mode === "resize" && keep) {
    column = Math.min(lastColumn, Math.max(0, keep.column - 1));
    row = Math.min(lastRow, Math.max(0, keep.row - 1));
    columnEnd = nearest(columns.ends, right, column, lastColumn);
    rowEnd = nearest(rows.ends, bottom, row, lastRow);
  } else {
    column = nearest(columns.starts, input.box.left, 0, lastColumn);
    row = nearest(rows.starts, input.box.top, 0, lastRow);
    columnEnd = nearest(columns.ends, right, column, lastColumn);
    rowEnd = nearest(rows.ends, bottom, row, lastRow);
  }

  const areaLeft = columns.starts[column] ?? 0;
  const areaTop = rows.starts[row] ?? 0;
  return {
    column: column + 1,
    columnSpan: columnEnd - column + 1,
    row: row + 1,
    rowSpan: rowEnd - row + 1,
    area: {
      left: areaLeft,
      top: areaTop,
      width: (columns.ends[columnEnd] ?? areaLeft) - areaLeft,
      height: (rows.ends[rowEnd] ?? areaTop) - areaTop,
    },
    columnAreas: columns.starts.map((start, index) => ({
      left: start,
      width: (columns.ends[index] ?? start) - start,
    })),
  };
}
