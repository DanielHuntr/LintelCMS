import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import type { Field, FieldOptions, FieldValidation } from "../fields/field.types.js";
import { numberFromInput } from "../fields/fieldValues.js";
import { t } from "../i18n/strings.js";
import type { FieldChanges } from "./blueprintDraft.js";

interface ValidationSettingsProps {
  field: Field;
  isRequiredLocked: boolean;
  /** Only an entry's own fields can be unique; inside a group there is nothing to compare. */
  canBeUnique: boolean;
  onChange: (changes: FieldChanges) => void;
  onOptionsChange: (options: FieldOptions) => void;
}

const textTypes = new Set(["text", "textarea", "markdown", "code", "slug", "email", "url"]);
/** Text fieldtypes whose limit is one of their own options (the editor stops typing at it). */
const limitInOptions = new Set(["text", "textarea", "markdown", "code"]);
const listTypes = new Set(["checkboxes", "list", "entries", "terms", "users"]);
/** List fieldtypes with their own "most that can be chosen" option. */
const mostInOptions = new Set(["list", "entries", "terms", "users"]);
const uniqueTypes = new Set([
  "text",
  "email",
  "url",
  "slug",
  "number",
  "select",
  "radio",
  "buttonGroup",
  "date",
  "hidden",
]);

/**
 * The Validation tab: whether the field is required, then the limits that suit its type
 * (characters for text, a range for numbers, how many for lists), a pattern, unique, and a
 * message of your own to show instead of Lintel's.
 */
export function ValidationSettings({
  field,
  isRequiredLocked,
  canBeUnique,
  onChange,
  onOptionsChange,
}: ValidationSettingsProps) {
  const rules = field.validation ?? {};
  const setRule = (changes: FieldValidation) => onChange({ validation: { ...rules, ...changes } });
  const setOption = (changes: FieldOptions) => onOptionsChange({ ...field.options, ...changes });
  const numberText = (value: number | undefined) => (value === undefined ? "" : String(value));
  const fromInput = (text: string) => numberFromInput(text) ?? undefined;
  const isText = textTypes.has(field.type);
  const isList = listTypes.has(field.type);

  return (
    <div className="flex flex-col gap-5">
      <Toggle
        label={t("builder.required")}
        checked={isRequiredLocked || field.required}
        disabled={isRequiredLocked}
        onCheckedChange={(required) => onChange({ required })}
      />

      {isText && (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("validation.minLength")}
            type="number"
            min={0}
            inputMode="numeric"
            value={numberText(rules.minLength)}
            onChange={(event) => setRule({ minLength: fromInput(event.target.value) })}
          />
          <TextField
            label={t("validation.maxLength")}
            hint={t("builder.maxLengthHint")}
            type="number"
            min={1}
            inputMode="numeric"
            value={numberText(
              limitInOptions.has(field.type) ? field.options.maxLength : rules.maxLength,
            )}
            onChange={(event) =>
              limitInOptions.has(field.type)
                ? setOption({ maxLength: fromInput(event.target.value) })
                : setRule({ maxLength: fromInput(event.target.value) })
            }
          />
        </div>
      )}

      {field.type === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("builder.min")}
            type="number"
            value={numberText(field.options.min)}
            onChange={(event) => setOption({ min: fromInput(event.target.value) })}
          />
          <TextField
            label={t("builder.max")}
            type="number"
            value={numberText(field.options.max)}
            onChange={(event) => setOption({ max: fromInput(event.target.value) })}
          />
        </div>
      )}

      {isList && (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("validation.fewest")}
            type="number"
            min={0}
            inputMode="numeric"
            value={numberText(rules.min)}
            onChange={(event) => setRule({ min: fromInput(event.target.value) })}
          />
          <TextField
            label={t("validation.most")}
            type="number"
            min={1}
            inputMode="numeric"
            value={numberText(mostInOptions.has(field.type) ? field.options.maxItems : rules.max)}
            onChange={(event) =>
              mostInOptions.has(field.type)
                ? setOption({ maxItems: fromInput(event.target.value) })
                : setRule({ max: fromInput(event.target.value) })
            }
          />
        </div>
      )}

      {isText && (
        <TextField
          label={t("validation.pattern")}
          hint={t("validation.patternHint")}
          value={rules.pattern ?? ""}
          spellCheck={false}
          className="[&_input]:font-mono [&_input]:text-footnote"
          onChange={(event) => setRule({ pattern: event.target.value || undefined })}
        />
      )}

      {canBeUnique && uniqueTypes.has(field.type) && (
        <div className="flex flex-col gap-1">
          <Toggle
            label={t("validation.unique")}
            checked={rules.unique === true}
            onCheckedChange={(unique) => setRule({ unique })}
          />
          <p className="text-footnote text-label-secondary">{t("validation.uniqueHint")}</p>
        </div>
      )}

      <TextField
        label={t("validation.message")}
        hint={t("validation.messageHint")}
        value={rules.message ?? ""}
        onChange={(event) => setRule({ message: event.target.value || undefined })}
      />
    </div>
  );
}
