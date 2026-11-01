import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LayoutTemplate, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../design/Button.js";
import { ConfirmDialog } from "../../design/ConfirmDialog.js";
import { t } from "../../i18n/strings.js";
import type { BlockType, BlockValue } from "../field.types.js";
import type { FieldEditorProps } from "../fieldEditorProps.js";
import { AddBlockSheet } from "./AddBlockSheet.js";
import { BlockCard } from "./BlockCard.js";
import {
  addBlock,
  blockErrors,
  blocksValue,
  changeBlockField,
  duplicateBlock,
  moveBlockBy,
  moveBlockTo,
  newBlockId,
  removeBlock,
} from "./blockValues.js";

/** Where focus should go once React has drawn the change. */
type PendingFocus = { kind: "firstField" | "toggle"; blockId: string } | { kind: "addButton" };

/**
 * A page builder: the blocks of a blocks field, in order. Editors add blocks from the
 * field's block types, drag them (or use the arrow buttons) into order, collapse the ones
 * they're done with, and duplicate or remove them. Each block's fields are drawn exactly as
 * an entry's own fields, through `renderField`.
 */
export function BlocksFieldEditor({
  field,
  value,
  onChange,
  innerErrors,
  renderField,
}: FieldEditorProps) {
  const blocks = blocksValue(value);
  const blockTypes = field.options.blockTypes ?? [];
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState<BlockValue | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Set by an action, used once React has drawn its result (the new block, say).
  const pendingFocus = useRef<PendingFocus | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const toggles = useRef(new Map<string, HTMLButtonElement>());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const isFull = field.options.maxBlocks !== undefined && blocks.length >= field.options.maxBlocks;

  const typeOf = (block: BlockValue) => blockTypes.find((type) => type.handle === block.type);
  const nameOf = (block: BlockValue) => typeOf(block)?.name ?? t("fields.blocks.unknownName");

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (pending.kind === "addButton") {
      container.current?.querySelector<HTMLElement>("[data-add-block]")?.focus();
    } else if (pending.kind === "toggle") {
      toggles.current.get(pending.blockId)?.focus();
    } else {
      const block = container.current?.querySelector(`[data-block-id="${pending.blockId}"]`);
      const firstControl = block?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, [contenteditable="true"]',
      );
      (firstControl ?? toggles.current.get(pending.blockId))?.focus();
    }
  });

  function update(next: BlockValue[]) {
    onChange(next.length === 0 ? null : next);
  }

  function add(blockType: BlockType) {
    const id = newBlockId();
    setIsAdding(false);
    update(addBlock(blocks, blockType.handle, id));
    setAnnouncement(
      t("fields.blocks.added", { name: blockType.name, position: blocks.length + 1 }),
    );
    pendingFocus.current = { kind: "firstField", blockId: id };
  }

  function move(block: BlockValue, reordered: BlockValue[]) {
    if (reordered.every((candidate, index) => candidate.id === blocks[index]?.id)) return;
    update(reordered);
    setAnnouncement(
      t("fields.blocks.moved", {
        name: nameOf(block),
        position: reordered.findIndex((candidate) => candidate.id === block.id) + 1,
        count: reordered.length,
      }),
    );
  }

  function duplicate(block: BlockValue) {
    const copyId = newBlockId();
    update(duplicateBlock(blocks, block.id, copyId));
    setAnnouncement(t("fields.blocks.duplicated", { name: nameOf(block) }));
    pendingFocus.current = { kind: "toggle", blockId: copyId };
  }

  function remove(block: BlockValue) {
    const index = blocks.findIndex((candidate) => candidate.id === block.id);
    const next = blocks[index + 1] ?? blocks[index - 1];
    setConfirmingRemoval(null);
    update(removeBlock(blocks, block.id));
    setAnnouncement(t("fields.blocks.removed", { name: nameOf(block) }));
    pendingFocus.current = next ? { kind: "toggle", blockId: next.id } : { kind: "addButton" };
  }

  function askToRemove(block: BlockValue) {
    const hasContent = Object.values(block.data).some(
      (fieldValue) => fieldValue !== null && fieldValue !== undefined && fieldValue !== "",
    );
    if (hasContent) setConfirmingRemoval(block);
    else remove(block);
  }

  function toggleCollapsed(blockId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const block = blocks.find((candidate) => candidate.id === active.id);
    if (!over || !block) return;
    move(block, moveBlockTo(blocks, block.id, String(over.id)));
  }

  if (blockTypes.length === 0) {
    return <p className="text-footnote text-label-secondary">{t("fields.blocks.noTypes")}</p>;
  }

  return (
    <div ref={container} className="flex flex-col gap-3">
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-card bg-background px-4 py-7 text-center hairline-ring">
          <LayoutTemplate
            aria-hidden="true"
            strokeWidth={1.5}
            className="mb-1 size-7 text-label-tertiary"
          />
          <p className="text-body font-medium text-label">{t("fields.blocks.emptyTitle")}</p>
          <p className="text-footnote text-label-secondary">
            {t("fields.blocks.emptyDescription")}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2.5">
              {blocks.map((block, index) => {
                const errors = blockErrors(innerErrors, block.id);
                // A block with a problem stays open, so the message can be seen and fixed.
                const isCollapsed = collapsed.has(block.id) && Object.keys(errors).length === 0;
                return (
                  <BlockCard
                    key={block.id}
                    fieldHandle={field.handle}
                    block={block}
                    blockType={typeOf(block)}
                    position={index + 1}
                    count={blocks.length}
                    isCollapsed={isCollapsed}
                    errors={errors}
                    toggleRef={(element) => {
                      if (element) toggles.current.set(block.id, element);
                      else toggles.current.delete(block.id);
                    }}
                    onToggleCollapsed={() => toggleCollapsed(block.id)}
                    onMove={(direction) => move(block, moveBlockBy(blocks, block.id, direction))}
                    onDuplicate={() => duplicate(block)}
                    onRemove={() => askToRemove(block)}
                    onFieldChange={(handle, fieldValue) =>
                      update(changeBlockField(blocks, block.id, handle, fieldValue))
                    }
                    renderField={renderField}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-3">
        <Button
          data-add-block
          variant="tinted"
          size="small"
          icon={<Plus aria-hidden="true" />}
          disabled={isFull}
          onClick={() => setIsAdding(true)}
        >
          {t("fields.blocks.add")}
        </Button>
        {isFull && (
          <p className="text-footnote text-label-secondary">
            {t("fields.blocks.limitReached", { label: field.label, count: blocks.length })}
          </p>
        )}
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <AddBlockSheet
        open={isAdding}
        fieldLabel={field.label}
        blockTypes={blockTypes}
        onClose={() => setIsAdding(false)}
        onPick={add}
      />
      <ConfirmDialog
        open={confirmingRemoval !== null}
        title={t("fields.blocks.removeTitle", {
          name: confirmingRemoval ? nameOf(confirmingRemoval) : "",
        })}
        message={t("fields.blocks.removeMessage")}
        confirmLabel={t("fields.blocks.remove")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setConfirmingRemoval(null)}
        onConfirm={() => confirmingRemoval && remove(confirmingRemoval)}
      />
    </div>
  );
}
