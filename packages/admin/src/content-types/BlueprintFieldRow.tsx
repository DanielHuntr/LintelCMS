import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Lock, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../design/Badge.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { DraftField } from "./blueprintDraft.js";
import { isTitleField } from "./blueprintDraft.js";
import { FieldtypeIcon } from "./fieldtypeIcons.js";

interface BlueprintFieldRowProps {
  field: DraftField;
  typeName: string;
  problem: string | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onOpenSettings: () => void;
  onRemove: () => void;
}

/** One field of the content type: its label, type and whether it's required. */
export function BlueprintFieldRow({
  field,
  typeName,
  problem,
  canMoveUp,
  canMoveDown,
  onMove,
  onOpenSettings,
  onRemove,
}: BlueprintFieldRowProps) {
  const isLocked = isTitleField(field);
  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({
    id: field.key,
    disabled: isLocked,
  });
  const label = field.label || t("builder.unnamedField");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: transition }}
      className={classNames(
        "group relative flex items-center bg-surface [&+&]:hairline-top",
        isDragging && "z-10 rounded-control shadow-float",
      )}
    >
      <span
        aria-hidden="true"
        {...(isLocked ? {} : listeners)}
        className={classNames(
          "flex items-center self-stretch pl-2 text-label-tertiary",
          isLocked
            ? "opacity-0"
            : "cursor-grab touch-none opacity-0 group-hover:opacity-100 active:cursor-grabbing",
        )}
      >
        <GripVertical strokeWidth={1.75} className="size-4" />
      </span>

      <button
        type="button"
        onClick={onOpenSettings}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-2 text-left transition-colors duration-150 ease-standard hover:bg-fill/50 focus-visible:focus-ring-inset"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary">
          <FieldtypeIcon type={field.type} className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          {/*
           * The button is named by what it shows (label, type and handle, "Required"), so
           * the name matches what people see and say to voice control.
           */}
          <span className="truncate text-body font-medium text-label">{label}</span>
          <span className="sr-only">, </span>
          <span
            className={classNames(
              "truncate text-footnote",
              problem ? "text-danger" : "text-label-secondary",
            )}
          >
            {problem ?? `${typeName} · ${field.handle}`}
          </span>
        </span>
        {field.required && <Badge>{t("fields.required")}</Badge>}
      </button>

      {/* The same width on every row, so the badges line up whether a row can move or not. */}
      {isLocked ? (
        <span className="flex w-25 shrink-0 items-center justify-end gap-1 pr-4 text-caption text-label-tertiary">
          <Lock aria-hidden="true" strokeWidth={2} className="size-3" />
          {t("builder.alwaysFirst")}
        </span>
      ) : (
        <span className="flex w-25 shrink-0 items-center justify-end gap-0.5 pr-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <RowButton
            label={t("builder.moveUp", { label })}
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
          </RowButton>
          <RowButton
            label={t("builder.moveDown", { label })}
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
          </RowButton>
          <RowButton
            label={t("builder.removeField", { label })}
            disabled={false}
            onClick={onRemove}
            tone="danger"
          >
            <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </RowButton>
        </span>
      )}
    </li>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  tone,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    // aria-disabled keeps focus on the button when a field reaches the end of the list.
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={classNames(
        "flex size-7 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30",
        tone === "danger" ? "hover:text-danger" : "hover:text-label",
      )}
    >
      {children}
    </button>
  );
}
