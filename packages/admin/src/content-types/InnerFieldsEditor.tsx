import { ChevronDown, ChevronUp, Plus, Settings2, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "../design/Button.js";
import type { Field, FieldType } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { AddFieldDialog } from "./AddFieldDialog.js";
import {
  addInnerField,
  changeInnerField,
  moveInnerField,
  removeInnerField,
  renameInnerField,
} from "./blockTypesDraft.js";
import { useFieldtypes } from "./blueprints.queries.js";
import type { FieldtypeDescription } from "./blueprints.types.js";
import { FieldSettingsDialog } from "./FieldSettingsDialog.js";
import { FieldtypeIcon } from "./fieldtypeIcons.js";
import { settingsProblem } from "./fieldSettingsDraft.js";

interface InnerFieldsEditorProps {
  /** The group's or repeater's label, for button names. */
  ownerLabel: string;
  fields: readonly Field[];
  /** The lists around the group, innermost first, for conditions looking outwards. */
  outerLevels: readonly (readonly Field[])[];
  onChange: (fields: Field[]) => void;
}

let nextKey = 0;
function newKey(): string {
  nextKey += 1;
  return `inner-${nextKey}`;
}

const canGoInside = (fieldtype: FieldtypeDescription) =>
  fieldtype.canBeInside !== false && fieldtype.type !== "blocks" && fieldtype.type !== "tab";

/**
 * The fields inside a group or repeater: a short list with each field's kind, buttons to move
 * and remove, and its full settings (the same dialog, opened on top) for widths, conditions
 * and validation inside the group.
 */
export function InnerFieldsEditor({
  ownerLabel,
  fields,
  outerLevels,
  onChange,
}: InnerFieldsEditorProps) {
  const fieldtypes = useFieldtypes();
  const [isAdding, setIsAdding] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = fields.find((field) => field.draft?.key === openKey) ?? null;
  const typeName = (type: string) =>
    fieldtypes.data?.find((fieldtype) => fieldtype.type === type)?.name ?? type;

  return (
    <section
      className="flex flex-col gap-2"
      aria-label={t("fieldOptions.innerFields", { label: ownerLabel })}
    >
      <h3 className="text-footnote font-medium text-label">
        {t("fieldOptions.innerFields", { label: ownerLabel || t("builder.unnamedField") })}
      </h3>
      {fields.length === 0 && (
        <p className="text-footnote text-label-secondary">{t("fieldOptions.noInnerFields")}</p>
      )}
      <ol className="overflow-hidden rounded-card bg-fill/40">
        {fields.map((field, index) => {
          const key = field.draft?.key ?? field.handle;
          const label = field.label || t("builder.unnamedField");
          const problem = settingsProblem(field, fields);
          return (
            <li key={key} className="flex items-center gap-2 px-2 py-1.5 [&+&]:hairline-top">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-surface text-label-secondary">
                <FieldtypeIcon type={field.type} className="size-3.5" />
              </span>
              <button
                type="button"
                onClick={() => setOpenKey(key)}
                className="flex min-w-0 flex-1 flex-col rounded-control px-1 text-start focus-visible:focus-ring"
              >
                <span className="truncate text-footnote font-medium text-label">{label}</span>
                <span
                  className={
                    problem
                      ? "truncate text-caption text-danger"
                      : "truncate text-caption text-label-secondary"
                  }
                >
                  {problem ??
                    `${typeName(field.type)} · ${field.width ?? 100}%${field.conditions ? ` · ${t("fieldOptions.conditional")}` : ""}`}
                </span>
              </button>
              <SmallButton
                label={t("builder.editField", { label })}
                onClick={() => setOpenKey(key)}
              >
                <Settings2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
              </SmallButton>
              <SmallButton
                label={t("builder.moveUp", { label })}
                disabled={index === 0}
                onClick={() => onChange(moveInnerField(fields, key, -1))}
              >
                <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
              </SmallButton>
              <SmallButton
                label={t("builder.moveDown", { label })}
                disabled={index === fields.length - 1}
                onClick={() => onChange(moveInnerField(fields, key, 1))}
              >
                <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
              </SmallButton>
              <SmallButton
                label={t("builder.removeField", { label })}
                onClick={() => onChange(removeInnerField(fields, key))}
              >
                <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
              </SmallButton>
            </li>
          );
        })}
      </ol>
      <Button
        variant="tinted"
        size="small"
        icon={<Plus aria-hidden="true" />}
        className="self-start"
        onClick={() => setIsAdding(true)}
      >
        {t("fieldOptions.addInnerField")}
      </Button>

      <AddFieldDialog
        open={isAdding}
        allows={canGoInside}
        onClose={() => setIsAdding(false)}
        onPick={(type: FieldType, name: string) => {
          const key = newKey();
          onChange(addInnerField(fields, key, type, name));
          setIsAdding(false);
          setOpenKey(key);
        }}
      />
      {open && (
        <FieldSettingsDialog
          field={open}
          typeName={typeName(open.type)}
          siblings={fields}
          outerLevels={outerLevels}
          problem={settingsProblem(open, fields) ?? undefined}
          handleHint={t("builder.handleHint")}
          isHandleLocked={false}
          canShowInList={false}
          onChange={(changes) => onChange(changeInnerField(fields, openKey ?? "", changes))}
          onOptionsChange={(options) =>
            onChange(changeInnerField(fields, openKey ?? "", { options }))
          }
          onHandleChange={(typed) => onChange(renameInnerField(fields, openKey ?? "", typed))}
          onRemove={() => {
            onChange(removeInnerField(fields, openKey ?? ""));
            setOpenKey(null);
          }}
          onClose={() => setOpenKey(null)}
        />
      )}
    </section>
  );
}

function SmallButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-surface hover:text-label focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30"
    >
      {children}
    </button>
  );
}
