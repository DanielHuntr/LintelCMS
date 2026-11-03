import { useSortable } from "@dnd-kit/sortable";
import { SiteBlockPreview } from "../../blocks/SiteBlockPreview.js";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Ellipsis,
  GripVertical,
  Trash2,
} from "lucide-react";
import { useId, type ReactNode, type Ref } from "react";
import { classNames } from "../../design/classNames.js";
import { Menu } from "../../design/Menu.js";
import { t } from "../../i18n/strings.js";
import { FieldGrid } from "../FieldGrid.js";
import type { BlockType, BlockValue, FieldValue } from "../field.types.js";
import type { InnerFieldProps } from "../fieldEditorProps.js";
import { BlockTypeIcon } from "./blockIcons.js";
import { blockSummary } from "./blockValues.js";

interface BlockCardProps {
  /** The blocks field's handle, for the `data-field-handle` that error focusing looks for. */
  fieldHandle: string;
  block: BlockValue;
  /** Undefined when the block's type has since been removed from the blueprint. */
  blockType: BlockType | undefined;
  position: number;
  count: number;
  isCollapsed: boolean;
  /** Messages for this block's fields, keyed by inner handle. */
  errors: Readonly<Record<string, string>>;
  /** The collapse button, so focus can be put back on the block after a move or duplicate. */
  toggleRef: Ref<HTMLButtonElement>;
  onToggleCollapsed: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onFieldChange: (handle: string, value: FieldValue) => void;
  renderField: (props: InnerFieldProps) => ReactNode;
}

/**
 * One block of a page builder field: a header that names it (and, collapsed, shows a few
 * words of it), with move, duplicate and remove; then its fields. Dragging uses the grip;
 * keyboard and screen reader users get the move buttons and a spoken confirmation instead.
 */
export function BlockCard({
  fieldHandle,
  block,
  blockType,
  position,
  count,
  isCollapsed,
  errors,
  toggleRef,
  onToggleCollapsed,
  onMove,
  onDuplicate,
  onRemove,
  onFieldChange,
  renderField,
}: BlockCardProps) {
  const bodyId = useId();
  const { setNodeRef, setActivatorNodeRef, transform, transition, isDragging, listeners } =
    useSortable({ id: block.id });
  const name = blockType?.name ?? t("fields.blocks.unknownName");
  const summary = blockSummary(block, blockType);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <li
      ref={setNodeRef}
      data-block-id={block.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={classNames("relative", isDragging && "z-10")}
    >
      <section
        aria-label={t("fields.blocks.blockLabel", { name, position, count })}
        className={classNames(
          "group rounded-card bg-background hairline-ring transition-shadow duration-150",
          isDragging && "shadow-float",
          hasErrors && "ring-1 ring-danger/60",
        )}
      >
        <div className="flex items-center gap-1 py-1.5 pe-1.5 ps-1">
          <span
            ref={setActivatorNodeRef}
            aria-hidden="true"
            {...listeners}
            className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-label-tertiary active:cursor-grabbing"
          >
            <GripVertical strokeWidth={1.75} className="size-4" />
          </span>
          <h3 className="min-w-0 flex-1">
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={!isCollapsed}
              aria-controls={bodyId}
              aria-label={
                isCollapsed
                  ? t("fields.blocks.expand", { name })
                  : t("fields.blocks.collapse", { name })
              }
              onClick={onToggleCollapsed}
              className="flex w-full min-w-0 items-center gap-2 rounded-control px-1.5 py-1 text-start transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
            >
              {isCollapsed ? (
                <ChevronRight
                  aria-hidden="true"
                  strokeWidth={2}
                  className="size-4 shrink-0 text-label-secondary"
                />
              ) : (
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={2}
                  className="size-4 shrink-0 text-label-secondary"
                />
              )}
              <BlockTypeIcon handle={block.type} className="size-4 shrink-0 text-accent" />
              <span className="shrink-0 text-body font-medium text-label">{name}</span>
              {isCollapsed && summary && (
                <span className="truncate text-footnote text-label-secondary">{summary}</span>
              )}
            </button>
          </h3>
          <span className="flex shrink-0 items-center gap-0.5">
            <IconButton
              label={t("fields.blocks.moveUp", { name })}
              disabled={position === 1}
              onClick={() => onMove(-1)}
            >
              <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
            </IconButton>
            <IconButton
              label={t("fields.blocks.moveDown", { name })}
              disabled={position === count}
              onClick={() => onMove(1)}
            >
              <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
            </IconButton>
            <Menu
              label={t("fields.blocks.more", { name })}
              trigger={<Ellipsis aria-hidden="true" strokeWidth={2} className="size-4" />}
              items={[
                ...(blockType
                  ? [{ label: t("fields.blocks.duplicate"), icon: Copy, onSelect: onDuplicate }]
                  : []),
                {
                  label: t("fields.blocks.remove"),
                  icon: Trash2,
                  tone: "danger" as const,
                  onSelect: onRemove,
                },
              ]}
            />
          </span>
        </div>

        <div id={bodyId} hidden={isCollapsed} className="flex flex-col gap-6 px-4 pt-2 pb-5">
          {!blockType && (
            <p className="text-footnote text-label-secondary">{t("fields.blocks.unknownType")}</p>
          )}
          {blockType && (
            // Conditions inside a block can look at its other fields, or out at the entry's.
            <FieldGrid
              fields={blockType.fields}
              data={block.data}
              errors={errors}
              onChange={onFieldChange}
              renderField={renderField}
              handlePrefix={`${fieldHandle}.${block.id}`}
            />
          )}
          {blockType?.block !== undefined && (
            <SiteBlockPreview blockType={blockType} values={block.data} />
          )}
        </div>
      </section>
    </li>
  );
}

function IconButton({
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
    // aria-disabled rather than disabled: moving a block to the top must not drop the focus.
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="flex size-8 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30"
    >
      {children}
    </button>
  );
}
