import {
  type Breakpoint,
  type GridLine,
  isStateTarget,
  lastOf,
  placedGridColumnChoices,
  readGridLine,
  resolveStyle,
} from "@lintel/builder-model";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup, inputClassName } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { useStyleEditing } from "./style-field.js";
import { StyleSelect, StyleTextInput } from "./StyleInputs.js";

type Text = ReturnType<typeof useBuilderText>;

export function selfAlignments(text: Text) {
  return [
    { value: "start", label: text("pageBuilder.style.alignStart") },
    { value: "center", label: text("pageBuilder.style.alignCentre") },
    { value: "end", label: text("pageBuilder.style.alignEnd") },
    { value: "stretch", label: text("pageBuilder.design.stretch") },
  ];
}

/** "Columns 2 to 6", "Column 3", or "The whole width" for an element not placed yet. */
export function gridPlaceSummary(gridColumn: string | undefined, text: Text): string {
  const line = readGridLine(gridColumn);
  return line ? describeLine(line, "columns", text) : text("pageBuilder.grid.notPlaced");
}

function describeLine(line: GridLine, axis: "columns" | "rows", text: Text): string {
  return line.span === 1
    ? text(axis === "columns" ? "pageBuilder.grid.columnsOne" : "pageBuilder.grid.rowsOne", {
        from: line.start,
      })
    : text(axis === "columns" ? "pageBuilder.grid.columnsRange" : "pageBuilder.grid.rowsRange", {
        from: line.start,
        to: lastOf(line),
      });
}

/** A placed grid's own settings: how many columns, and whether phones stack. */
export function GridSettings() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const grid = tools.node.placedGrid;
  if (!grid) return null;
  return (
    <>
      <ChoiceGroup
        label={text("pageBuilder.grid.columns")}
        value={String(grid.columns)}
        onChange={(columns) => tools.setPlacedGrid({ ...grid, columns: Number(columns) })}
        choices={placedGridColumnChoices.map((count) => ({
          value: String(count),
          label: String(count),
        }))}
      />
      <label className="flex items-center gap-2 text-footnote text-label">
        <input
          type="checkbox"
          checked={grid.stackOnPhone}
          onChange={(event) => tools.setPlacedGrid({ ...grid, stackOnPhone: event.target.checked })}
          className="size-4 accent-[var(--color-accent-fill)]"
        />
        {text("pageBuilder.grid.stackOnPhone")}
      </label>
      <p className="text-caption text-label-tertiary">{text("pageBuilder.grid.hint")}</p>
    </>
  );
}

/**
 * Where the selected element sits on its grid, at the screen size being edited: "Columns
 * [2] to [6]" and "Rows [1] to [2]", with the exact CSS folded away. On phones, while the
 * grid stacks and the element has no phone place of its own, it says so and offers one.
 */
export function GridPlaceControls({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const { styles, target, change } = useStyleEditing();
  const grid = tools.parent?.placedGrid;
  if (!grid) return null;
  const breakpoint: Breakpoint = isStateTarget(target) ? "base" : (target as Breakpoint);
  const label = text("pageBuilder.design.arrange");
  const stacked =
    breakpoint === "phone" &&
    grid.stackOnPhone &&
    styles.phone?.gridColumn === undefined &&
    styles.phone?.gridRow === undefined;
  const column = readGridLine(resolveStyle(styles, breakpoint, "gridColumn").value);
  const row = readGridLine(resolveStyle(styles, breakpoint, "gridRow").value);

  if (stacked) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-footnote text-label-secondary">
          {text("pageBuilder.grid.stackedOnPhone")}
        </p>
        <button
          type="button"
          onClick={() =>
            change(
              {
                gridColumn: column ? lineValue(column) : `1 / span ${grid.columns}`,
                gridRow: row ? lineValue(row) : undefined,
              },
              label,
            )
          }
          className="self-start rounded-control bg-fill px-2.5 py-1 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
        >
          {text("pageBuilder.grid.placeOnPhone")}
        </button>
      </div>
    );
  }

  const columnLine = column ?? { start: 1, span: grid.columns };
  const rowCount = Math.max(8, (row ? lastOf(row) : 1) + 4);
  return (
    <div className="flex flex-col gap-3">
      <LineChooser
        axis="columns"
        line={columnLine}
        count={grid.columns}
        onChange={(next) => change({ gridColumn: lineValue(next) }, label)}
      />
      <LineChooser
        axis="rows"
        line={row}
        count={rowCount}
        onChange={(next) => change({ gridRow: lineValue(next) }, label)}
      />
      <p className="text-caption text-label-tertiary">{text("pageBuilder.grid.keysHint")}</p>
      {breakpoint === "phone" && grid.stackOnPhone && (
        <button
          type="button"
          onClick={() => change({ gridColumn: undefined, gridRow: undefined }, label)}
          className="self-start rounded-control bg-fill px-2.5 py-1 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
        >
          {text("pageBuilder.grid.stackAgain")}
        </button>
      )}
      <details className="group rounded-control">
        <summary className="cursor-pointer text-caption text-label-secondary hover:text-label focus-visible:focus-ring">
          {text("pageBuilder.grid.exact")}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StyleTextInput
            property="gridColumn"
            label={text("pageBuilder.grid.columnValue")}
            placeholder="2 / span 5"
          />
          <StyleTextInput
            property="gridRow"
            label={text("pageBuilder.grid.rowValue")}
            placeholder="1 / span 2"
          />
          <StyleSelect
            property="justifySelf"
            label={text("pageBuilder.design.justifySelf")}
            choices={selfAlignments(text)}
          />
          <StyleSelect
            property="alignSelf"
            label={text("pageBuilder.design.alignSelf")}
            choices={selfAlignments(text)}
          />
          {advanced && (
            <StyleTextInput
              property="zIndex"
              label={text("pageBuilder.style.zIndex")}
              placeholder="auto"
            />
          )}
        </div>
      </details>
    </div>
  );
}

/** `2 / span 5`, or `3` for one column or row. */
function lineValue(line: GridLine): string {
  return line.span > 1 ? `${line.start} / span ${line.span}` : String(line.start);
}

/** "Columns [2] to [6]": two short lists, the second never before the first. */
function LineChooser({
  axis,
  line,
  count,
  onChange,
}: {
  axis: "columns" | "rows";
  line: GridLine | undefined;
  count: number;
  onChange: (line: GridLine) => void;
}) {
  const text = useBuilderText();
  const numbers = Array.from({ length: count }, (_, index) => index + 1);
  const start = line?.start ?? 0;
  const last = line ? lastOf(line) : 0;
  const isColumns = axis === "columns";
  const select = "h-8 w-16 shrink-0";
  return (
    <div
      role="group"
      aria-label={text(isColumns ? "pageBuilder.grid.columns" : "pageBuilder.grid.rows")}
      className="flex items-center gap-2"
    >
      <span className="w-16 shrink-0 text-caption text-label-secondary">
        {text(isColumns ? "pageBuilder.grid.columns" : "pageBuilder.grid.rows")}
      </span>
      <select
        aria-label={text(isColumns ? "pageBuilder.grid.columnsFrom" : "pageBuilder.grid.rowsFrom")}
        value={start || ""}
        onChange={(event) => {
          // Moving the start keeps the span, as dragging does, as far as the grid allows.
          const from = Number(event.target.value);
          const span = line?.span ?? 1;
          onChange({ start: from, span: isColumns ? Math.min(span, count - from + 1) : span });
        }}
        className={`${inputClassName} ${select}`}
      >
        {!line && <option value="">–</option>}
        {numbers.map((number) => (
          <option key={number} value={number}>
            {number}
          </option>
        ))}
      </select>
      <span className="text-caption text-label-tertiary">{text("pageBuilder.grid.to")}</span>
      <select
        aria-label={text(isColumns ? "pageBuilder.grid.columnsTo" : "pageBuilder.grid.rowsTo")}
        value={last || ""}
        onChange={(event) => {
          const to = Number(event.target.value);
          const from = Math.min(start || 1, to);
          onChange({ start: from, span: to - from + 1 });
        }}
        className={`${inputClassName} ${select}`}
      >
        {!line && <option value="">–</option>}
        {numbers.map((number) => (
          <option key={number} value={number}>
            {number}
          </option>
        ))}
      </select>
    </div>
  );
}
