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

  const grid = (tabFields: readonly Field[]) => (
    <FieldGrid
      fields={tabFields}
      data={data}
      errors={errors}
      onChange={onChange}
      renderField={renderField}
    />
  );

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
