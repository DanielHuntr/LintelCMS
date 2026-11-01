import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import type { FieldOptions } from "../fields/field.types.js";
import { numberFromInput } from "../fields/fieldValues.js";
import { t } from "../i18n/strings.js";
import type { DraftField } from "./blueprintDraft.js";
import { ChoicesEditor } from "./ChoicesEditor.js";

interface FieldTypeOptionsProps {
  field: DraftField;
  onChange: (options: FieldOptions) => void;
}

/** The settings that only some fieldtypes have: limits, choices, whether to include a time. */
export function FieldTypeOptions({ field, onChange }: FieldTypeOptionsProps) {
  const { options } = field;
  const set = (changes: FieldOptions) => onChange({ ...options, ...changes });
  const numberText = (value: number | undefined) => (value === undefined ? "" : String(value));
  const numberOption = (text: string) => numberFromInput(text) ?? undefined;

  switch (field.type) {
    case "text":
    case "textarea":
      return (
        <TextField
          label={t("builder.maxLength")}
          hint={t("builder.maxLengthHint")}
          type="number"
          min={1}
          inputMode="numeric"
          value={numberText(options.maxLength)}
          onChange={(event) => set({ maxLength: numberOption(event.target.value) })}
          className="max-w-48"
        />
      );

    case "number":
      return (
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label={t("builder.min")}
            type="number"
            value={numberText(options.min)}
            onChange={(event) => set({ min: numberOption(event.target.value) })}
          />
          <TextField
            label={t("builder.max")}
            type="number"
            value={numberText(options.max)}
            onChange={(event) => set({ max: numberOption(event.target.value) })}
          />
          <TextField
            label={t("builder.step")}
            type="number"
            min={0}
            value={numberText(options.step)}
            onChange={(event) => set({ step: numberOption(event.target.value) })}
          />
        </div>
      );

    case "select":
      return (
        <div className="flex flex-col gap-4">
          <Toggle
            label={t("builder.multiple")}
            checked={options.multiple === true}
            onCheckedChange={(multiple) => set({ multiple })}
          />
          <ChoicesEditor choices={options.choices ?? []} onChange={(choices) => set({ choices })} />
        </div>
      );

    case "date":
      return (
        <Toggle
          label={t("builder.includeTime")}
          checked={options.includeTime === true}
          onCheckedChange={(includeTime) => set({ includeTime })}
        />
      );

    default:
      return null;
  }
}
