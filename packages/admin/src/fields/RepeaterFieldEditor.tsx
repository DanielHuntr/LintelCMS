import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { innerErrors as errorsWithin, newBlockId } from "./blocks/blockValues.js";
import type { RepeaterRow } from "./field.types.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { FieldGrid } from "./FieldGrid.js";

/** A repeater's rows, without anything that isn't one. */
export function repeaterRows(value: unknown): RepeaterRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row: unknown) => {
    if (typeof row !== "object" || row === null || !("id" in row)) return [];
    const { id, data } = row as { id: unknown; data?: unknown };
    return typeof id === "string"
      ? [
          {
            id,
            data: typeof data === "object" && data !== null ? (data as RepeaterRow["data"]) : {},
          },
        ]
      : [];
  });
}

/**
 * Rows of the same few fields, such as the speakers at an event. Each row is a small card
 * with its fields on the grid, and buttons to move or remove it; the add button's words can
 * be set per field ("Add a speaker").
 */
export function RepeaterFieldEditor({
  field,
  value,
  onChange,
  innerErrors,
  renderField,
  controlId,
}: FieldEditorProps) {
  const rows = repeaterRows(value);
  const { maxRows, addLabel } = field.options;
  const isFull = maxRows !== undefined && rows.length >= maxRows;
  const save = (next: RepeaterRow[]) => onChange(next.length === 0 ? null : next);

  function move(index: number, direction: -1 | 1) {
    const next = [...rows];
    const [moving] = next.splice(index, 1);
    if (!moving) return;
    next.splice(index + direction, 0, moving);
    save(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="text-footnote text-label-secondary">{t("fields.repeater.empty")}</p>
      )}
      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const name = t("fields.repeater.row", { number: index + 1 });
          return (
            <li key={row.id} className="rounded-card bg-surface p-4 hairline-ring">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex-1 text-footnote font-medium text-label-secondary">
                  {name}
                </span>
                <RowButton
                  label={t("fields.repeater.moveUp", { name })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
                </RowButton>
                <RowButton
                  label={t("fields.repeater.moveDown", { name })}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
                </RowButton>
                <RowButton
                  label={t("fields.repeater.remove", { name })}
                  disabled={false}
                  onClick={() => save(rows.filter((other) => other.id !== row.id))}
                >
                  <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </RowButton>
              </div>
              <FieldGrid
                fields={field.options.fields ?? []}
                data={row.data}
                errors={errorsWithin(innerErrors, row.id)}
                onChange={(handle, innerValue) =>
                  save(
                    rows.map((other) =>
                      other.id === row.id
                        ? { ...other, data: { ...other.data, [handle]: innerValue } }
                        : other,
                    ),
                  )
                }
                renderField={renderField}
                handlePrefix={`${field.handle}.${row.id}`}
              />
            </li>
          );
        })}
      </ol>
      <Button
        id={controlId}
        variant="tinted"
        size="small"
        icon={<Plus aria-hidden="true" />}
        disabled={isFull}
        className="self-start"
        onClick={() => save([...rows, { id: newBlockId(), data: {} }])}
      >
        {addLabel || t("fields.repeater.add")}
      </Button>
    </div>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="flex size-7 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30"
    >
      {children}
    </button>
  );
}
