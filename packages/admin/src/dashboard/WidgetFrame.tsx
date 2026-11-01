import { ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import type { WidgetSize } from "../plugins/adminPlugin.js";

/** How many of the grid's six columns each size takes, once there is room for columns. */
const sizeColumns: Record<WidgetSize, string> = {
  small: "@2xl:col-span-2",
  medium: "@2xl:col-span-3",
  large: "@2xl:col-span-6",
};

interface WidgetFrameProps {
  widgetId: string;
  title: string;
  size: WidgetSize;
  position: number;
  count: number;
  isEditing: boolean;
  onMove: (offset: -1 | 1) => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  children: ReactNode;
}

/**
 * One widget on the dashboard: a card with its title. In Edit mode it gains a drag handle,
 * buttons to move it earlier or later (the keyboard way to reorder), a size control and a
 * remove button. Dragging is for pointers; the buttons do the same for everyone else.
 */
export function WidgetFrame({
  widgetId,
  title,
  size,
  position,
  count,
  isEditing,
  onMove,
  onResize,
  onRemove,
  children,
}: WidgetFrameProps) {
  const { setNodeRef, setActivatorNodeRef, transform, transition, isDragging, listeners } =
    useSortable({ id: widgetId, disabled: !isEditing });

  return (
    <li
      ref={setNodeRef}
      data-widget={widgetId}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={classNames("col-span-6 min-w-0", sizeColumns[size], isDragging && "z-10")}
    >
      <section
        aria-label={t("dashboard.widgetLabel", { title, position, count })}
        className={classNames(
          "flex h-full flex-col rounded-card bg-surface p-5 transition-shadow duration-150",
          isEditing && "ring-1 ring-separator",
          isDragging && "shadow-float",
        )}
      >
        <header className="mb-4 flex min-h-7 items-center gap-2">
          {isEditing && (
            <span
              ref={setActivatorNodeRef}
              aria-hidden="true"
              {...listeners}
              className="-ml-1.5 flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-label-tertiary active:cursor-grabbing"
            >
              <GripVertical strokeWidth={1.75} className="size-4" />
            </span>
          )}
          <h2 className="min-w-0 flex-1 truncate text-headline text-label">{title}</h2>
          {isEditing && (
            <span className="flex shrink-0 items-center gap-0.5">
              <FrameButton
                label={t("dashboard.moveEarlier", { title })}
                disabled={position === 1}
                onClick={() => onMove(-1)}
              >
                <ChevronLeft aria-hidden="true" strokeWidth={2} className="size-4" />
              </FrameButton>
              <FrameButton
                label={t("dashboard.moveLater", { title })}
                disabled={position === count}
                onClick={() => onMove(1)}
              >
                <ChevronRight aria-hidden="true" strokeWidth={2} className="size-4" />
              </FrameButton>
              <FrameButton
                label={t("dashboard.remove", { title })}
                onClick={onRemove}
                tone="danger"
              >
                <X aria-hidden="true" strokeWidth={2} className="size-4" />
              </FrameButton>
            </span>
          )}
        </header>
        {isEditing && (
          <div className="mb-4">
            <SegmentedControl
              label={t("dashboard.size", { title })}
              value={size}
              onChange={onResize}
              options={[
                { value: "small", label: t("dashboard.size.small") },
                { value: "medium", label: t("dashboard.size.medium") },
                { value: "large", label: t("dashboard.size.large") },
              ]}
            />
          </div>
        )}
        {/* While editing, the widget is a preview: its links and buttons step aside. */}
        <div inert={isEditing} className={classNames("flex-1", isEditing && "opacity-60")}>
          {children}
        </div>
      </section>
    </li>
  );
}

interface FrameButtonProps {
  label: string;
  disabled?: boolean;
  tone?: "default" | "danger";
  onClick: () => void;
  children: ReactNode;
}

function FrameButton({ label, disabled, tone = "default", onClick, children }: FrameButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        "flex size-8 items-center justify-center rounded-control transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring disabled:opacity-30 disabled:hover:bg-transparent",
        tone === "danger" ? "text-danger" : "text-label-secondary",
      )}
    >
      {children}
    </button>
  );
}
