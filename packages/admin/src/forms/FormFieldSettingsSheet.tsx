import { useState } from "react";
import { cleanTypedHandle, handleFromLabel } from "../content-types/handle.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t, type StringKey } from "../i18n/strings.js";
import { FormFieldTypeOptions } from "./FormFieldTypeOptions.js";
import { formFieldTypeInfo } from "./formFieldTypes.js";
import type { FormField } from "./forms.types.js";

interface FormFieldSettingsSheetProps {
  field: FormField;
  problem: StringKey | undefined;
  onChange: (changes: Partial<FormField>) => void;
  onRelabel: (label: string, handleFollowsLabel: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * One field's settings. Changes show in the preview as they're made and are saved with
 * the page's Save button. The handle is tucked under "Advanced": most people never need it.
 */
export function FormFieldSettingsSheet({
  field,
  problem,
  onChange,
  onRelabel,
  onRemove,
  onClose,
}: FormFieldSettingsSheetProps) {
  // A field whose handle has been typed by hand keeps it when the label changes.
  const [handleFollowsLabel, setHandleFollowsLabel] = useState(() =>
    handleMatchesLabel(field.handle, field.label),
  );
  const isStep = field.type === "step";
  const isHidden = field.type === "hidden";
  const asksSomething = !isStep && !isHidden;

  return (
    <Dialog
      open
      onClose={onClose}
      title={field.label || t("forms.builder.unnamed")}
      description={t(formFieldTypeInfo[field.type].name)}
      footer={
        <>
          <Button variant="destructive" className="me-auto" onClick={onRemove}>
            {t("forms.builder.removeField")}
          </Button>
          <Button onClick={onClose}>{t("forms.builder.done")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pt-2 pb-1">
        <TextField
          label={
            isStep
              ? t("forms.field.stepTitle")
              : field.type === "consent"
                ? t("forms.field.consentText")
                : t("forms.field.label")
          }
          value={field.label}
          data-autofocus
          error={problem === "forms.problem.noLabel" ? t(problem) : undefined}
          onChange={(event) => onRelabel(event.target.value, handleFollowsLabel)}
        />
        {!isStep && (
          <TextField
            label={t("forms.field.help")}
            hint={t("forms.field.helpHint")}
            value={field.helpText}
            onChange={(event) => onChange({ helpText: event.target.value })}
          />
        )}
        {(field.type === "shortText" ||
          field.type === "longText" ||
          field.type === "email" ||
          field.type === "phone" ||
          field.type === "number") && (
          <TextField
            label={t("forms.field.placeholder")}
            hint={t("forms.field.placeholderHint")}
            value={field.placeholder}
            onChange={(event) => onChange({ placeholder: event.target.value })}
          />
        )}
        {asksSomething && (
          <Toggle
            label={field.type === "consent" ? t("forms.field.mustTick") : t("forms.field.required")}
            checked={field.required}
            onCheckedChange={(required) => onChange({ required })}
          />
        )}

        <FormFieldTypeOptions field={field} problem={problem} onChange={onChange} />

        {!isStep && (
          <details className="rounded-control bg-fill/50 px-3 py-2">
            <summary className="cursor-pointer text-footnote font-medium text-label-secondary">
              {t("forms.field.advanced")}
            </summary>
            <div className="pt-3 pb-1">
              <TextField
                label={t("forms.field.handle")}
                hint={t("forms.field.handleHint")}
                value={field.handle}
                error={
                  problem === "forms.problem.badHandle" || problem === "forms.problem.sameHandle"
                    ? t(problem)
                    : undefined
                }
                onChange={(event) => {
                  setHandleFollowsLabel(false);
                  onChange({ handle: cleanTypedHandle(event.target.value) });
                }}
              />
            </div>
          </details>
        )}
      </div>
    </Dialog>
  );
}

/** "name" or "name_2" for "Name": the handle was made from the label, not typed. */
function handleMatchesLabel(handle: string, label: string): boolean {
  const fromLabel = handleFromLabel(label) || "field";
  return handle === fromLabel || new RegExp(`^${fromLabel}_\\d+$`).test(handle);
}
