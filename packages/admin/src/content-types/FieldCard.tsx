import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, EyeOff, GripVertical, Lock, Trash2 } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Badge } from "../design/Badge.js";
import { classNames } from "../design/classNames.js";
import { fieldWidths, type FieldWidth } from "../fields/field.types.js";
import { widthClass, widthNearestColumns } from "../fields/fieldLayout.js";
import { t } from "../i18n/strings.js";
import { isTitleField, type DraftField } from "./blueprintDraft.js";
import { FieldtypeIcon } from "./fieldtypeIcons.js";

interface FieldCardProps {
  field: DraftField;
  typeName: string;
  problem: string | undefined;
  canEdit: boolean;
  /** The grid the card sits on, to turn a dragged edge into a width. */
  gridElement: () => HTMLElement | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onOpenSettings: () => void;
  onResize: (width: FieldWidth) => void;
  onRemove: () => void;
}

/**
 * One field on the builder's canvas, as wide as it will be in the editor. Drag the grip to
 * move it; drag its right edge (or focus the edge and use the arrow keys) to change its width;
 * click it for its settings.
 */
export function FieldCard({
  field,
  typeName,
  problem,
  canEdit,
  gridElement,
  canMoveUp,
  canMoveDown,
  onMove,
  onOpenSettings,
  onResize,
  onRemove,
}: FieldCardProps) {
  const isLocked = isTitleField(field);
  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({
    id: field.key,
    disabled: isLocked || !canEdit,
  });
  const label = field.label || t("builder.unnamedField");
  const width = field.width ?? 100;
  const isLayout = field.type === "section" || field.type === "spacer";
  const resizing = useRef(false);

  function widthAtPointer(event: PointerEvent<HTMLElement>, card: HTMLElement): FieldWidth {
    const grid = gridElement();
    if (!grid) return width;
    const gridBox = grid.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const columns = ((event.clientX - cardBox.left) / gridBox.width) * 12;
    return widthNearestColumns(columns);
  }

  function handleEdgeKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = fieldWidths.indexOf(width);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const next = fieldWidths[index + step];
    if (step === 0 || next === undefined) return;
    event.preventDefault();
    onResize(next);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-field-key={field.key}
      className={classNames(
        "group/card relative min-w-0",
        widthClass(field.type === "section" ? 100 : width),
        isDragging && "z-10",
      )}
    >
      <div
        className={classNames(
          "@container/card relative flex h-full min-h-16 items-center gap-2 rounded-card pe-3 ps-1 hairline-ring transition-shadow duration-150 ease-standard",
          field.type === "spacer"
            ? "border border-dashed border-label-tertiary/50 bg-transparent"
            : "bg-surface",
          field.type === "section" && "bg-fill/50",
          isDragging && "shadow-float",
          problem && "ring-1 ring-danger",
        )}
      >
        <span
          aria-hidden="true"
          {...(isLocked || !canEdit ? {} : listeners)}
          className={classNames(
            "flex items-center self-stretch px-1 text-label-tertiary",
            isLocked || !canEdit
              ? "opacity-0"
              : "cursor-grab touch-none opacity-40 group-hover/card:opacity-100 active:cursor-grabbing",
          )}
        >
          <GripVertical strokeWidth={1.75} className="size-4" />
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("builder.editField", { label })}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control py-2.5 text-start focus-visible:focus-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary">
            <FieldtypeIcon type={field.type} className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={classNames(
                "truncate font-medium text-label",
                isLayout ? "text-footnote" : "text-body",
              )}
            >
              {label}
            </span>
            <span
              className={classNames(
                "truncate text-caption",
                problem ? "text-danger" : "text-label-secondary",
              )}
            >
              {problem ?? `${typeName} · ${field.handle}`}
            </span>
          </span>
        </button>
        <span
          className={classNames(
            "hidden shrink-0 items-center gap-1 @[26rem]/card:flex",
            // The move and remove buttons take this place on hover, so the badges make way.
            canEdit &&
              !isLocked &&
              "transition-opacity duration-150 group-hover/card:opacity-0 group-focus-within/card:opacity-0",
          )}
        >
          {field.required && <Badge>{t("fields.required")}</Badge>}
          {field.conditions && <Badge tone="accent">{t("builder.badge.conditional")}</Badge>}
          {field.hidden && (
            <EyeOff
              aria-label={t("builder.badge.hidden")}
              className="size-3.5 text-label-tertiary"
            />
          )}
          {isLocked && (
            <Lock
              aria-label={t("builder.alwaysFirst")}
              strokeWidth={2}
              className="size-3 text-label-tertiary"
            />
          )}
        </span>
        {canEdit && !isLocked && (
          // Over the card's right end, so the label keeps the room until the pointer is here.
          <span className="absolute top-1/2 inset-e-2 flex -translate-y-1/2 items-center rounded-control bg-surface opacity-0 shadow-thumb transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100">
            <IconButton
              label={t("builder.moveUp", { label })}
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
            >
              <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
            </IconButton>
            <IconButton
              label={t("builder.moveDown", { label })}
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
            >
              <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
            </IconButton>
            <IconButton
              label={t("builder.removeField", { label })}
              tone="danger"
              onClick={onRemove}
            >
              <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
            </IconButton>
          </span>
        )}
      </div>
      {canEdit && field.type !== "section" && (
        <button
          type="button"
          aria-label={t("builder.resize", { label, width })}
          title={t("builder.resize", { label, width })}
          onKeyDown={handleEdgeKey}
          onPointerDown={(event) => {
            const card = event.currentTarget.parentElement;
            if (!card) return;
            resizing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const card = event.currentTarget.parentElement;
            if (!resizing.current || !card) return;
            const next = widthAtPointer(event, card);
            if (next !== width) onResize(next);
          }}
          onPointerUp={() => {
            resizing.current = false;
          }}
          className="absolute top-2 -inset-e-1.5 bottom-2 flex w-3 cursor-ew-resize items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:focus-ring"
        >
          <span aria-hidden="true" className="h-8 w-1.5 rounded-full bg-accent" />
        </button>
      )}
    </li>
  );
}

function IconButton({
  label,
  disabled = false,
  tone,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  tone?: "danger";
  onClick: () => void;
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
        "flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary transition duration-150 ease-standard hover:bg-fill focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30",
        tone === "danger" ? "hover:text-danger" : "hover:text-label",
      )}
    >
      {children}
    </button>
  );
}
