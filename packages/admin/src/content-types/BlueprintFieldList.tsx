import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import type { FieldMessages } from "../api/client.js";
import { t } from "../i18n/strings.js";
import { isTitleField, type DraftField } from "./blueprintDraft.js";
import { BlueprintFieldRow } from "./BlueprintFieldRow.js";

interface BlueprintFieldListProps {
  fields: readonly DraftField[];
  problems: FieldMessages;
  typeNameOf: (type: string) => string;
  onMoveBy: (key: string, direction: -1 | 1) => void;
  onMoveTo: (key: string, targetKey: string) => void;
  onOpenSettings: (key: string) => void;
  onRemove: (field: DraftField) => void;
}

/** The content type's fields in order. Drag a row, or use its arrow buttons, to reorder. */
export function BlueprintFieldList({
  fields,
  problems,
  typeNameOf,
  onMoveBy,
  onMoveTo,
  onOpenSettings,
  onRemove,
}: BlueprintFieldListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [announcement, setAnnouncement] = useState("");
  // The title is locked first, so the first movable field is at index 1.
  const firstMovable = fields.findIndex((field) => !isTitleField(field));

  function announceMove(key: string, newIndex: number) {
    const field = fields.find((candidate) => candidate.key === key);
    setAnnouncement(
      t("builder.moved", {
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
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        onMoveTo(String(active.id), String(over.id));
        announceMove(
          String(active.id),
          fields.findIndex((field) => field.key === over.id),
        );
      }}
    >
      <SortableContext
        items={fields.map((field) => field.key)}
        strategy={verticalListSortingStrategy}
      >
        <ul aria-label={t("builder.fields")} className="overflow-hidden rounded-card bg-surface">
          {fields.map((field, index) => (
            <BlueprintFieldRow
              key={field.key}
              field={field}
              typeName={typeNameOf(field.type)}
              problem={problems[field.key]}
              canMoveUp={index > firstMovable}
              canMoveDown={index < fields.length - 1}
              onMove={(direction) => {
                onMoveBy(field.key, direction);
                announceMove(field.key, index + direction);
              }}
              onOpenSettings={() => onOpenSettings(field.key)}
              onRemove={() => onRemove(field)}
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
