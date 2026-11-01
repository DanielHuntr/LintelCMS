import { classNames } from "../class-names.js";

export interface DataTableProps {
  /** A table field's value: rows of cells, every row the same length. */
  rows: string[][] | null;
  /** The first row is column headings (the table field's default). */
  headerRow?: boolean;
  /** Says what the table is, for screen readers and as a visible caption. */
  caption?: string;
  field?: string;
  className?: string;
}

/**
 * A table field drawn as a real table, with the first row as column headings unless told
 * otherwise. Output: `<table class="lintel-table">` with `<thead>` and `<tbody>`.
 */
export function DataTable({ rows, headerRow = true, caption, field, className }: DataTableProps) {
  if (!rows || rows.length === 0) {
    return null;
  }
  const [first, ...rest] = rows;
  const head = headerRow ? first : undefined;
  const body = headerRow ? rest : rows;
  return (
    <table className={classNames("lintel-table", className)} data-lintel-field={field}>
      {caption && <caption>{caption}</caption>}
      {head && (
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={index} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {body.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, index) => (
              <td key={index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
