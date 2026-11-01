import {
  type Announcements,
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useState } from "react";
import { Badge } from "../design/Badge.js";
import { classNames } from "../design/classNames.js";
import { t, type StringKey } from "../i18n/strings.js";
import { formFieldTypeInfo } from "./formFieldTypes.js";
import type { FormField } from "./forms.types.js";

interface FormFieldListProps {
  fields: readonly FormField[];
  problems: Readonly<Record<string, StringKey>>;
  onMoveBy: (fieldId: string, direction: -1 | 1) => void;
  onMoveTo: (fieldId: string, targetId: string) => void;
  onOpen: (fieldId: string) => void;
}

/**
 * The form's fields in order. Drag a row by its handle, or use the arrow buttons; each
 * move is announced, so it works the same with a keyboard and a screen reader.
 */
export function FormFieldList({
  fields,
  problems,
  onMoveBy,
  onMoveTo,
  onOpen,
}: FormFieldListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [announcement, setAnnouncement] = useState("");

  function announce(fieldId: string, newIndex: number) {
    const field = fields.find((candidate) => candidate.id === fieldId);
    setAnnouncement(
      t("forms.builder.moved", {
        label: field?.label ?? "",
        position: newIndex + 1,
        count: fields.length,
      }),
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      accessibility={{ announcements: dragAnnouncements(fields) }}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        onMoveTo(String(active.id), String(over.id));
        announce(
          String(active.id),
          fields.findIndex((field) => field.id === over.id),
        );
      }}
    >
      <SortableContext
        items={fields.map((field) => field.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          aria-label={t("forms.builder.fields")}
          className="overflow-hidden rounded-card bg-surface"
        >
          {fields.map((field, index) => (
            <FormFieldRow
              key={field.id}
              field={field}
              problem={problems[field.id]}
              canMoveUp={index > 0}
              canMoveDown={index < fields.length - 1}
              onMove={(direction) => {
                onMoveBy(field.id, direction);
                announce(field.id, index + direction);
              }}
              onOpen={() => onOpen(field.id)}
            />
          ))}
        </ul>
      </SortableContext>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </DndContext>
  );
}

function dragAnnouncements(fields: readonly FormField[]): Announcements {
  const labelOf = (id: string | number) =>
    fields.find((field) => field.id === String(id))?.label ?? "";
  const positionOf = (id: string | number) =>
    fields.findIndex((field) => field.id === String(id)) + 1;
  return {
    onDragStart: ({ active }) => t("forms.builder.dragStart", { label: labelOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("forms.builder.moved", {
            label: labelOf(active.id),
            position: positionOf(over.id),
            count: fields.length,
          })
        : undefined,
    onDragEnd: ({ active }) => t("forms.builder.dropped", { label: labelOf(active.id) }),
    onDragCancel: ({ active }) => t("forms.builder.dragCancelled", { label: labelOf(active.id) }),
  };
}

interface FormFieldRowProps {
  field: FormField;
  problem: StringKey | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onOpen: () => void;
}

function FormFieldRow({
  field,
  problem,
  canMoveUp,
  canMoveDown,
  onMove,
  onOpen,
}: FormFieldRowProps) {
  const { setNodeRef, transform, transition, isDragging, listeners, attributes } = useSortable({
    id: field.id,
  });
  const info = formFieldTypeInfo[field.type];
  const Icon = info.icon;
  const label = field.label || t("forms.builder.unnamed");
  const isStep = field.type === "step";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={classNames(
        "group relative flex items-center bg-surface [&+&]:hairline-top",
        isStep && "bg-fill/40",
        isDragging && "z-10 rounded-control shadow-float",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("forms.builder.dragHandle", { label })}
        className="flex cursor-grab touch-none items-center self-stretch rounded-control pe-1 ps-2 text-label-tertiary hover:text-label-secondary focus-visible:focus-ring-inset active:cursor-grabbing"
      >
        <GripVertical aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-label={t("forms.builder.editField", { label })}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pe-3 ps-1 text-start transition-colors duration-150 ease-standard hover:bg-fill/50 focus-visible:focus-ring-inset"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={classNames(
              "truncate text-body text-label",
              isStep ? "font-semibold" : "font-medium",
            )}
          >
            {label}
          </span>
          <span
            className={classNames(
              "truncate text-footnote",
              problem ? "text-danger" : "text-label-secondary",
            )}
          >
            {problem ? t(problem) : t(info.name)}
          </span>
        </span>
        {field.required && <Badge tone="neutral">{t("forms.builder.required")}</Badge>}
      </button>

      <div className="flex shrink-0 items-center gap-0.5 pe-2">
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          aria-label={t("forms.builder.moveUp", { label })}
          className="flex size-8 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring disabled:opacity-30"
        >
          <ChevronUp aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          aria-label={t("forms.builder.moveDown", { label })}
          className="flex size-8 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring disabled:opacity-30"
        >
          <ChevronDown aria-hidden="true" className="size-4" />
        </button>
      </div>
    </li>
  );
}
