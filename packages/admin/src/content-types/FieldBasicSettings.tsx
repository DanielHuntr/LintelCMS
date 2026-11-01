import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { FieldEditor } from "../fields/FieldEditor.js";
import type { Field, FieldValue } from "../fields/field.types.js";
import { canHaveDefault, canHavePlaceholder } from "../fields/fieldLayout.js";
import { t } from "../i18n/strings.js";
import type { FieldChanges } from "./blueprintDraft.js";
import type { FieldSettingsDialogProps } from "./FieldSettingsDialog.js";
import { WidthPicker } from "./WidthPicker.js";

/** The Basics tab: label, handle, help text, placeholder and default value. */
export function BasicSettings({
  field,
  labelProblem,
  handleHint,
  isHandleLocked,
  onChange,
  onHandleChange,
}: FieldSettingsDialogProps & { labelProblem: string | undefined }) {
  const isLayout = field.type === "section" || field.type === "spacer" || field.type === "tab";
  return (
    <div className="flex flex-col gap-5">
      <TextField
        label={field.type === "section" ? t("fieldSettings.heading") : t("builder.label")}
        value={field.label}
        error={labelProblem}
        data-autofocus
        onChange={(event) => onChange({ label: event.target.value })}
      />
      <TextField
        label={t("builder.handle")}
        hint={handleHint}
        value={field.handle}
        disabled={isHandleLocked}
        spellCheck={false}
        autoCapitalize="off"
        className="[&_input]:font-mono [&_input]:text-footnote"
        onChange={(event) => onHandleChange(event.target.value)}
      />
      {field.type !== "spacer" && field.type !== "tab" && (
        <TextField
          label={field.type === "section" ? t("fieldSettings.sectionText") : t("builder.helpText")}
          hint={isLayout ? undefined : t("builder.helpTextHint")}
          value={field.helpText ?? ""}
          onChange={(event) => onChange({ helpText: event.target.value })}
        />
      )}
      {canHavePlaceholder(field) && (
        <TextField
          label={t("fieldSettings.placeholder")}
          hint={t("fieldSettings.placeholderHint")}
          value={field.placeholder ?? ""}
          onChange={(event) => onChange({ placeholder: event.target.value })}
        />
      )}
      {field.type === "hidden" && (
        <TextField
          label={t("fieldSettings.default")}
          hint={t("fieldSettings.hiddenDefaultHint")}
          value={typeof field.default === "string" ? field.default : String(field.default ?? "")}
          onChange={(event) => onChange({ default: event.target.value || undefined })}
        />
      )}
      {canHaveDefault(field) && field.type !== "hidden" && (
        <div className="rounded-card bg-fill/40 p-4">
          <FieldEditor
            field={{
              ...field,
              label: t("fieldSettings.default"),
              helpText: t("fieldSettings.defaultHint"),
              helpTextPosition: "below",
              required: false,
              readOnly: false,
              hidden: false,
              conditions: undefined,
            }}
            value={field.default}
            onChange={(_handle, value: FieldValue) =>
              onChange({ default: value === null ? undefined : value })
            }
          />
        </div>
      )}
    </div>
  );
}

/** The Appearance tab: width, where the help goes, read only, hidden, a column in lists. */
export function AppearanceSettings({
  field,
  canShowInList,
  onChange,
}: {
  field: Field;
  canShowInList: boolean;
  onChange: (changes: FieldChanges) => void;
}) {
  const holdsValue = !["tab", "section", "spacer"].includes(field.type);
  return (
    <div className="flex flex-col gap-6">
      {field.type !== "tab" && (
        <section className="flex flex-col gap-2">
          <h3 className="text-footnote font-medium text-label">{t("fieldSettings.width")}</h3>
          <WidthPicker value={field.width ?? 100} onChange={(width) => onChange({ width })} />
          <p className="text-footnote text-label-secondary">{t("fieldSettings.widthHint")}</p>
        </section>
      )}
      {holdsValue && field.type !== "hidden" && (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="text-footnote font-medium text-label">
              {t("fieldSettings.helpPosition")}
            </h3>
            <SegmentedControl
              label={t("fieldSettings.helpPosition")}
              options={[
                { value: "below", label: t("fieldSettings.helpBelow") },
                { value: "above", label: t("fieldSettings.helpAbove") },
              ]}
              value={field.helpTextPosition ?? "below"}
              onChange={(helpTextPosition) => onChange({ helpTextPosition })}
            />
          </section>
          <div className="flex flex-col gap-4">
            <Toggle
              label={t("fieldSettings.readOnly")}
              checked={field.readOnly === true}
              onCheckedChange={(readOnly) => onChange({ readOnly })}
            />
            <Toggle
              label={t("fieldSettings.hidden")}
              checked={field.hidden === true}
              onCheckedChange={(hidden) => onChange({ hidden })}
            />
            {canShowInList && (
              <Toggle
                label={t("fieldSettings.showInList")}
                checked={field.showInList === true}
                onCheckedChange={(showInList) => onChange({ showInList })}
              />
            )}
          </div>
          <p className="text-footnote text-label-secondary">{t("fieldSettings.hiddenHint")}</p>
        </>
      )}
    </div>
  );
}
