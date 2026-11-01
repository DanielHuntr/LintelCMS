import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { FieldMessages } from "../api/client.js";
import { EntryFields } from "../content/EntryFields.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { radioGroupTargetIndex } from "../design/radioGroupKeys.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { defaultValues, splitIntoTabs } from "../fields/fieldLayout.js";
import { t } from "../i18n/strings.js";
import { isTitleField, type BlueprintDraftAction, type DraftField } from "./blueprintDraft.js";
import { FieldCard } from "./FieldCard.js";

interface FieldLayoutCanvasProps {
  fields: readonly DraftField[];
  problems: FieldMessages;
  canEdit: boolean;
  typeNameOf: (type: string) => string;
  dispatch: (action: BlueprintDraftAction) => void;
  onOpenSettings: (key: string) => void;
  onRemove: (field: DraftField) => void;
  /** Opens "Add a field", to add after the given field (the end of the tab being looked at). */
  onAddField: (afterKey: string | undefined) => void;
  /** Adds a Tab field at the end, which starts a new tab. */
  onAddTab: () => void;
}

/**
 * The builder's canvas: the fields laid out as they will be in the editor, on a 12-column
 * grid, split into tabs by Tab fields, with section headings across the row. Drag a card to
 * move it (or use its arrow buttons), drag its right edge to change its width, and switch to
 * Preview to see the editor itself.
 */
export function FieldLayoutCanvas({
  fields,
  problems,
  canEdit,
  typeNameOf,
  dispatch,
  onOpenSettings,
  onRemove,
  onAddField,
  onAddTab,
}: FieldLayoutCanvasProps) {
  const baseId = useId();
  // Dragging is for the pointer; by keyboard each card has move buttons instead.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const gridElement = useRef<HTMLOListElement>(null);
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [mode, setMode] = useState<"build" | "preview">("build");
  const [chosenTab, setChosenTab] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const tabs = splitIntoTabs(fields);
  const current = Math.min(chosenTab, tabs.length - 1);
  const shown = tabs[current]?.fields ?? [];
  const hasTabs = tabs.length > 1 || tabs[0]?.tab !== null;
  const firstMovable = fields.findIndex((field) => !isTitleField(field));

  function announceMove(key: string, targetKey: string) {
    const field = fields.find((candidate) => candidate.key === key);
    const position = fields.findIndex((candidate) => candidate.key === targetKey);
    setAnnouncement(
      t("builder.moved", {
        label: field?.label ?? "",
        position: position + 1,
        count: fields.length,
      }),
    );
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = radioGroupTargetIndex(event.key, index, tabs.length);
    if (target === undefined) return;
    event.preventDefault();
    setChosenTab(target);
    tabButtons.current[target]?.focus();
  }

  const lastKeyOfTab = shown.at(-1)?.key ?? tabs[current]?.tab?.key;

  return (
    <section aria-labelledby={`${baseId}-heading`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 id={`${baseId}-heading`} className="text-headline text-label">
            {t("builder.fields")}
          </h2>
          <p className="text-footnote text-label-secondary">{t("builder.canvasHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            label={t("builder.view")}
            options={[
              { value: "build", label: t("builder.view.build") },
              { value: "preview", label: t("builder.view.preview") },
            ]}
            value={mode}
            onChange={setMode}
          />
          {canEdit && mode === "build" && (
            <Button
              variant="tinted"
              size="small"
              icon={<Plus aria-hidden="true" />}
              onClick={() => onAddField(lastKeyOfTab)}
            >
              {t("builder.addField")}
            </Button>
          )}
        </div>
      </div>

      {mode === "preview" ? (
        <div className="rounded-card bg-surface p-6 hairline-ring">
          <p className="mb-5 text-footnote text-label-secondary">{t("builder.previewHint")}</p>
          <EntryFields
            fields={fields}
            data={defaultValues(fields)}
            errors={{}}
            onChange={() => undefined}
          />
        </div>
      ) : (
        <div className="@container flex flex-col gap-3">
          {hasTabs && (
            <div
              role="tablist"
              aria-label={t("builder.tabs")}
              className="flex items-center gap-1 overflow-x-auto hairline-bottom"
            >
              {tabs.map((tab, index) => {
                const isCurrent = index === current;
                const hasProblem = tab.fields.some((field) => problems[field.key]);
                return (
                  <button
                    key={tab.tab?.key ?? "main"}
                    ref={(element) => {
                      tabButtons.current[index] = element;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isCurrent}
                    aria-controls={`${baseId}-canvas`}
                    tabIndex={isCurrent ? 0 : -1}
                    onClick={() => setChosenTab(index)}
                    onDoubleClick={() => tab.tab && onOpenSettings(tab.tab.key)}
                    onKeyDown={(event) => handleTabKey(event, index)}
                    className={classNames(
                      "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-body whitespace-nowrap",
                      "transition-colors duration-150 ease-standard focus-visible:focus-ring-inset",
                      isCurrent
                        ? "border-accent font-medium text-label"
                        : "border-transparent text-label-secondary hover:text-label",
                    )}
                  >
                    {tab.tab?.label || t("editor.mainTab")}
                    {hasProblem && (
                      <span
                        className="size-1.5 rounded-full bg-danger"
                        aria-label={t("editor.tabHasProblem")}
                      />
                    )}
                  </button>
                );
              })}
              {canEdit && (
                <button
                  type="button"
                  onClick={onAddTab}
                  className="ms-1 flex h-8 items-center gap-1 rounded-full px-2.5 text-footnote text-accent hover:bg-fill focus-visible:focus-ring"
                >
                  <Plus aria-hidden="true" strokeWidth={2} className="size-3.5" />
                  {t("builder.addTab")}
                </button>
              )}
              {canEdit && tabs[current]?.tab && (
                <button
                  type="button"
                  onClick={() => tabs[current]?.tab && onOpenSettings(tabs[current].tab.key)}
                  className="ms-auto flex h-8 items-center rounded-full px-2.5 text-footnote text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
                >
                  {t("builder.tabSettings")}
                </button>
              )}
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return;
              dispatch({
                type: "fieldMovedTo",
                key: String(active.id),
                targetKey: String(over.id),
              });
              announceMove(String(active.id), String(over.id));
            }}
          >
            <SortableContext items={shown.map((field) => field.key)} strategy={rectSortingStrategy}>
              <ol
                ref={gridElement}
                id={`${baseId}-canvas`}
                aria-label={t("builder.fields")}
                className="grid grid-cols-12 gap-2.5 rounded-card bg-fill/30 p-2.5"
              >
                {shown.length === 0 && (
                  <li className="col-span-12 px-3 py-8 text-center text-body text-label-secondary">
                    {t("builder.emptyTab")}
                  </li>
                )}
                {shown.map((field) => {
                  const index = fields.indexOf(field);
                  return (
                    <FieldCard
                      key={field.key}
                      field={field}
                      typeName={typeNameOf(field.type)}
                      problem={problems[field.key]}
                      canEdit={canEdit}
                      gridElement={() => gridElement.current}
                      canMoveUp={index > firstMovable}
                      canMoveDown={index < fields.length - 1}
                      onMove={(direction) => {
                        dispatch({ type: "fieldMovedBy", key: field.key, direction });
                        const target = fields[index + direction];
                        if (target) announceMove(field.key, target.key);
                      }}
                      onOpenSettings={() => onOpenSettings(field.key)}
                      onResize={(width) =>
                        dispatch({ type: "fieldChanged", key: field.key, changes: { width } })
                      }
                      onRemove={() => onRemove(field)}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
          {canEdit && !hasTabs && (
            <button
              type="button"
              onClick={onAddTab}
              className="self-start rounded-full px-2.5 py-1 text-footnote text-accent hover:bg-fill focus-visible:focus-ring"
            >
              {t("builder.splitIntoTabs")}
            </button>
          )}
        </div>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
