import { LayoutTemplate } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { FieldMessages } from "../api/client.js";
import { classNames } from "../design/classNames.js";
import { radioGroupTargetIndex } from "../design/radioGroupKeys.js";
import { innerErrors } from "../fields/blocks/blockValues.js";
import { FieldEditor } from "../fields/FieldEditor.js";
import { FieldGrid } from "../fields/FieldGrid.js";
import { splitIntoTabs } from "../fields/fieldLayout.js";
import {
  titleFieldHandle,
  type EntryData,
  type Field,
  type FieldValue,
} from "../fields/field.types.js";
import type { InnerFieldProps } from "../fields/fieldEditorProps.js";
import { t } from "../i18n/strings.js";
import { fieldsReplacedByDesign } from "./designReplacedFields.js";

interface EntryFieldsProps {
  fields: readonly Field[];
  data: EntryData;
  errors: FieldMessages;
  onChange: (handle: string, value: FieldValue) => void;
}

/**
 * The blueprint's fields, in its order, on the 12-column grid. The title is drawn
 * separately, as the document's heading. Tab fields split the form into tabs; a tab with a
 * problem after a save is marked, so nothing that needs fixing is out of sight.
 */
export function EntryFields({ fields, data, errors, onChange }: EntryFieldsProps) {
  const baseId = useId();
  const tabs = splitIntoTabs(fields.filter((field) => field.handle !== titleFieldHandle));
  const [chosenTab, setChosenTab] = useState(0);
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const current = Math.min(chosenTab, tabs.length - 1);
  // Fields the page's design takes the place of on the website wait behind a note, so nobody
  // writes into a Body that isn't shown (LINTEL-UX-006).
  const replaced = fieldsReplacedByDesign(fields, data);
  const [showsReplaced, setShowsReplaced] = useState(false);
  const replacedHasProblem = Object.keys(errors).some((key) =>
    replaced.has(key.split(".")[0] ?? key),
  );

  function renderField({ field, value, onChange: change, error }: InnerFieldProps) {
    return (
      <FieldEditor
        key={field.handle}
        field={field}
        value={value}
        onChange={change}
        error={error}
        innerErrors={innerErrors(errors, field.handle)}
      />
    );
  }

  const fieldGrid = (gridFields: readonly Field[]) => (
    <FieldGrid
      fields={gridFields}
      data={data}
      errors={errors}
      onChange={onChange}
      renderField={renderField}
    />
  );

  function grid(tabFields: readonly Field[]) {
    const waiting = tabFields.filter((field) => replaced.has(field.handle));
    if (waiting.length === 0) return fieldGrid(tabFields);
    const isOpen = showsReplaced || replacedHasProblem;
    return (
      <div className="flex flex-col gap-6">
        {fieldGrid(tabFields.filter((field) => !replaced.has(field.handle)))}
        <div className="flex flex-col gap-3 rounded-card bg-accent/10 p-4">
          <p className="flex items-start gap-2.5 text-body text-label">
            <LayoutTemplate aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
            {t("editor.replacedByDesign", {
              fields: waiting.map((field) => field.label).join(", "),
              count: waiting.length,
            })}
          </p>
          {!replacedHasProblem && (
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setShowsReplaced(!isOpen)}
              className="inline-flex min-h-6 w-fit items-center rounded-control text-footnote font-medium text-accent focus-visible:focus-ring"
            >
              {isOpen ? t("editor.hideReplacedFields") : t("editor.showReplacedFields")}
            </button>
          )}
          {isOpen && fieldGrid(waiting)}
        </div>
      </div>
    );
  }

  if (tabs.length <= 1) return grid(tabs[0]?.fields ?? []);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = radioGroupTargetIndex(event.key, index, tabs.length);
    if (target === undefined) return;
    event.preventDefault();
    setChosenTab(target);
    tabButtons.current[target]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={t("editor.fieldTabs")}
        className="flex gap-1 overflow-x-auto hairline-bottom"
      >
        {tabs.map((tab, index) => {
          const hasProblem = tab.fields.some((field) =>
            Object.keys(errors).some(
              (key) => key === field.handle || key.startsWith(`${field.handle}.`),
            ),
          );
          const isCurrent = index === current;
          return (
            <button
              key={tab.tab?.handle ?? "main"}
              ref={(element) => {
                tabButtons.current[index] = element;
              }}
              id={`${baseId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={isCurrent ? 0 : -1}
              onClick={() => setChosenTab(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={classNames(
                "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-body whitespace-nowrap",
                "transition-colors duration-150 ease-standard focus-visible:focus-ring-inset",
                isCurrent
                  ? "border-accent font-medium text-label"
                  : "border-transparent text-label-secondary hover:text-label",
              )}
            >
              {tab.tab?.label ?? t("editor.mainTab")}
              {hasProblem && (
                <span
                  className="size-1.5 rounded-full bg-danger"
                  aria-label={t("editor.tabHasProblem")}
                />
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, index) => (
        // Every tab stays drawn, so a field's state (and an error to focus) survives switching.
        <div
          key={tab.tab?.handle ?? "main"}
          id={`${baseId}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={index !== current}
        >
          {grid(tab.fields)}
        </div>
      ))}
    </div>
  );
}
