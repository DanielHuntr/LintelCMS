import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { radioGroupTargetIndex } from "../design/radioGroupKeys.js";
import type { Field, FieldOptions } from "../fields/field.types.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { FieldChanges } from "./blueprintDraft.js";
import { conditionTargets } from "./conditionTargets.js";
import { ConditionsEditor } from "./ConditionsEditor.js";
import { AppearanceSettings, BasicSettings } from "./FieldBasicSettings.js";
import { FieldPreview } from "./FieldPreview.js";
import { hasTypeOptions, FieldTypeOptions } from "./FieldTypeOptions.js";
import { ValidationSettings } from "./ValidationSettings.js";

type SettingsTab = "basics" | "appearance" | "conditions" | "validation" | "options";

const tabNames: Record<SettingsTab, StringKey> = {
  basics: "fieldSettings.tab.basics",
  appearance: "fieldSettings.tab.appearance",
  conditions: "fieldSettings.tab.conditions",
  validation: "fieldSettings.tab.validation",
  options: "fieldSettings.tab.options",
};

export interface FieldSettingsDialogProps {
  field: Field;
  typeName: string;
  /** The other fields in the same list, for conditions and "made from". */
  siblings: readonly Field[];
  /** For a field inside a group, repeater or block: the lists around it, innermost first. */
  outerLevels?: readonly (readonly Field[])[];
  problem: string | undefined;
  /** Locked for the title; the hint says why, or how the handle is made. */
  handleHint: string;
  isHandleLocked: boolean;
  /** Required can't be turned off for the title. */
  isRequiredLocked?: boolean;
  /** Only an entry's own fields can be columns in the list of entries. */
  canShowInList: boolean;
  onChange: (changes: FieldChanges) => void;
  onOptionsChange: (options: FieldOptions) => void;
  onHandleChange: (typed: string) => void;
  /** Left out when the field can't be removed (the title). */
  onRemove?: () => void;
  onClose: () => void;
}

/**
 * A field's settings, in tabs: Basics (label, handle, help, placeholder, default), Appearance
 * (width, help position, read only, hidden, list column), Conditions, Validation and the
 * options of its type. A live preview beside them shows the field as editors will see it.
 * Changes apply as they're made; the content type is saved with the page's Save button.
 */
export function FieldSettingsDialog(props: FieldSettingsDialogProps) {
  const {
    field,
    typeName,
    siblings,
    outerLevels = [],
    problem,
    onChange,
    onRemove,
    onClose,
  } = props;
  const baseId = useId();
  const holdsValue = !["tab", "section", "spacer"].includes(field.type);
  const tabs: SettingsTab[] = [
    "basics",
    "appearance",
    "conditions",
    ...(holdsValue && field.type !== "revealer" ? (["validation"] as const) : []),
    ...(hasTypeOptions(field.type) ? (["options"] as const) : []),
  ];
  const [chosen, setChosen] = useState<SettingsTab>("basics");
  const current = tabs.includes(chosen) ? chosen : "basics";
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const targets = conditionTargets(field, siblings, outerLevels);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = radioGroupTargetIndex(event.key, index, tabs.length);
    const tab = target === undefined ? undefined : tabs[target];
    if (target === undefined || !tab) return;
    event.preventDefault();
    setChosen(tab);
    tabButtons.current[target]?.focus();
  }

  const panels: Record<SettingsTab, () => ReactNode> = {
    basics: () => <BasicSettings {...props} labelProblem={problem} />,
    appearance: () => (
      <AppearanceSettings field={field} canShowInList={props.canShowInList} onChange={onChange} />
    ),
    conditions: () => (
      <ConditionsEditor
        conditions={field.conditions}
        targets={targets}
        onChange={(conditions) => onChange({ conditions })}
      />
    ),
    validation: () => (
      <ValidationSettings
        field={field}
        isRequiredLocked={props.isRequiredLocked === true}
        canBeUnique={outerLevels.length === 0}
        onChange={onChange}
        onOptionsChange={props.onOptionsChange}
      />
    ),
    options: () => (
      <FieldTypeOptions
        field={field}
        siblings={siblings}
        outerLevels={outerLevels}
        problem={problem}
        onChange={props.onOptionsChange}
      />
    ),
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={field.label || t("builder.unnamedField")}
      description={typeName}
      size="wide"
      bodyClassName="flex min-h-0 flex-1"
      footer={
        <>
          {onRemove && (
            <Button variant="destructive" className="mr-auto" onClick={onRemove}>
              {t("builder.remove")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.done")}</Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          role="tablist"
          aria-label={t("fieldSettings.tabs")}
          className="flex shrink-0 gap-1 overflow-x-auto px-6 hairline-bottom"
        >
          {tabs.map((tab, index) => {
            const isCurrent = tab === current;
            return (
              <button
                key={tab}
                ref={(element) => {
                  tabButtons.current[index] = element;
                }}
                id={`${baseId}-${tab}`}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-controls={`${baseId}-${tab}-panel`}
                tabIndex={isCurrent ? 0 : -1}
                onClick={() => setChosen(tab)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={classNames(
                  "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-footnote font-medium whitespace-nowrap",
                  "transition-colors duration-150 ease-standard focus-visible:focus-ring-inset",
                  isCurrent
                    ? "border-accent text-label"
                    : "border-transparent text-label-secondary hover:text-label",
                )}
              >
                {t(tabNames[tab])}
                {tab === "conditions" && field.conditions && (
                  <span
                    className="size-1.5 rounded-full bg-accent"
                    aria-label={t("fieldSettings.hasConditions")}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div
          id={`${baseId}-${current}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${current}`}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        >
          {panels[current]()}
        </div>
      </div>
      <aside
        aria-label={t("fieldSettings.preview")}
        className="hidden w-[min(36%,340px)] shrink-0 flex-col gap-3 overflow-y-auto bg-background/60 p-5 shadow-[inset_0.5px_0_0_var(--color-separator)] md:flex"
      >
        <h3 className="text-footnote font-medium text-label-secondary">
          {t("fieldSettings.preview")}
        </h3>
        <FieldPreview field={field} siblings={siblings} />
      </aside>
    </Dialog>
  );
}
