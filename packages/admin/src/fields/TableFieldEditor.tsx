import { Minus, Plus } from "lucide-react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";

/** Rows of cells; every row has the same number of cells. */
export function tableValue(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  const rows = value.map((row) =>
    Array.isArray(row) ? row.map((cell) => (typeof cell === "string" ? cell : "")) : [],
  );
  const columns = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => [...row, ...Array<string>(columns - row.length).fill("")]);
}

/** A table with nothing in any cell is stored as empty. */
function tableOrEmpty(rows: string[][]): string[][] | null {
  return rows.every((row) => row.every((cell) => cell.trim() === "")) ? null : rows;
}

/**
 * A small table of text: type in the cells, add and remove rows and columns. With a header
 * row, the first row is the column headings and is drawn bold.
 */
export function TableFieldEditor({ field, value, onChange, controlId }: FieldEditorProps) {
  const stored = tableValue(value);
  const rows =
    stored.length === 0
      ? [
          ["", ""],
          ["", ""],
        ]
      : stored;
  const columnCount = rows[0]?.length ?? 2;
  const hasHeader = field.options.headerRow !== false;
  const maxRows = field.options.maxRows;
  const maxColumns = field.options.maxColumns ?? 20;
  const save = (next: string[][]) => onChange(tableOrEmpty(next));

  function setCell(rowIndex: number, columnIndex: number, text: string) {
    save(
      rows.map((row, index) =>
        index === rowIndex
          ? row.map((cell, column) => (column === columnIndex ? text : cell))
          : row,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-control hairline-ring">
        <table className="w-full border-collapse text-footnote">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="[&+&]:hairline-top">
                {row.map((cell, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="min-w-28 p-0 [&+&]:shadow-[inset_0.5px_0_0_var(--color-separator)]"
                  >
                    <input
                      id={rowIndex === 0 && columnIndex === 0 ? controlId : undefined}
                      value={cell}
                      aria-label={t("fields.table.cell", {
                        row: rowIndex + 1,
                        column: columnIndex + 1,
                      })}
                      onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
                      className={classNames(
                        "h-9 w-full bg-transparent px-2.5 text-label outline-none focus-visible:focus-ring-inset",
                        hasHeader && rowIndex === 0 && "bg-fill/60 font-semibold",
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="tinted"
          size="small"
          icon={<Plus aria-hidden="true" />}
          disabled={maxRows !== undefined && rows.length >= maxRows}
          onClick={() => save([...rows, Array<string>(columnCount).fill("")])}
        >
          {t("fields.table.addRow")}
        </Button>
        <Button
          variant="tinted"
          size="small"
          icon={<Plus aria-hidden="true" />}
          disabled={columnCount >= maxColumns}
          onClick={() => save(rows.map((row) => [...row, ""]))}
        >
          {t("fields.table.addColumn")}
        </Button>
        <Button
          variant="plain"
          size="small"
          icon={<Minus aria-hidden="true" />}
          disabled={rows.length <= 1}
          onClick={() => save(rows.slice(0, -1))}
        >
          {t("fields.table.removeRow")}
        </Button>
        <Button
          variant="plain"
          size="small"
          icon={<Minus aria-hidden="true" />}
          disabled={columnCount <= 1}
          onClick={() => save(rows.map((row) => row.slice(0, -1)))}
        >
          {t("fields.table.removeColumn")}
        </Button>
      </div>
    </div>
  );
}
