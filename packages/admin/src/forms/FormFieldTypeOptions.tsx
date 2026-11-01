import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t, type StringKey } from "../i18n/strings.js";
import { cleanChoices } from "./formDraft.js";
import { hasChoices } from "./formFieldTypes.js";
import type { FileKind, FormField, FormFieldOptions } from "./forms.types.js";
import { TextAreaField } from "./TextAreaField.js";

interface FormFieldTypeOptionsProps {
  field: FormField;
  problem: StringKey | undefined;
  onChange: (changes: Partial<FormField>) => void;
}

/** The settings only some kinds of field have: choices, limits, file types... */
export function FormFieldTypeOptions({ field, problem, onChange }: FormFieldTypeOptionsProps) {
  const options = field.options;
  const setOptions = (changes: FormFieldOptions) =>
    onChange({ options: { ...options, ...changes } });

  if (hasChoices(field.type)) {
    return (
      <TextAreaField
        label={t("forms.field.choices")}
        hint={t("forms.field.choicesHint")}
        error={problem === "forms.problem.noChoices" ? t(problem) : undefined}
        rows={5}
        value={(options.choices ?? []).join("\n")}
        onChange={(event) => setOptions({ choices: event.target.value.split("\n") })}
        onBlur={() => setOptions({ choices: cleanChoices(options.choices ?? []) })}
      />
    );
  }

  switch (field.type) {
    case "shortText":
    case "longText":
      return (
        <NumberPair
          first={{ label: "forms.field.minLength", value: options.minLength }}
          second={{ label: "forms.field.maxLength", value: options.maxLength }}
          onChange={(minLength, maxLength) => setOptions({ minLength, maxLength })}
        />
      );
    case "number":
      return (
        <>
          <NumberPair
            first={{ label: "forms.field.min", value: options.min }}
            second={{ label: "forms.field.max", value: options.max }}
            onChange={(min, max) => setOptions({ min, max })}
          />
          <Toggle
            label={t("forms.field.wholeNumber")}
            checked={options.wholeNumber ?? false}
            onCheckedChange={(wholeNumber) => setOptions({ wholeNumber })}
          />
        </>
      );
    case "date":
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            type="date"
            label={t("forms.field.earliest")}
            value={options.earliest ?? ""}
            onChange={(event) => setOptions({ earliest: event.target.value || undefined })}
          />
          <TextField
            type="date"
            label={t("forms.field.latest")}
            value={options.latest ?? ""}
            onChange={(event) => setOptions({ latest: event.target.value || undefined })}
          />
        </div>
      );
    case "file":
      return <FileOptions options={options} problem={problem} onChange={setOptions} />;
    case "hidden":
      return (
        <TextField
          label={t("forms.field.hiddenValue")}
          hint={t("forms.field.hiddenValueHint")}
          value={options.defaultValue ?? ""}
          onChange={(event) => setOptions({ defaultValue: event.target.value })}
        />
      );
    case "step":
      return <p className="text-footnote text-label-secondary">{t("forms.field.stepHint")}</p>;
    default:
      return null;
  }
}

function FileOptions({
  options,
  problem,
  onChange,
}: {
  options: FormFieldOptions;
  problem: StringKey | undefined;
  onChange: (changes: FormFieldOptions) => void;
}) {
  const kinds = options.allowedKinds ?? [];
  const toggleKind = (kind: FileKind, on: boolean) =>
    onChange({
      allowedKinds: (["images", "documents"] as const).filter((candidate) =>
        candidate === kind ? on : kinds.includes(candidate),
      ),
    });

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-footnote text-label">{t("forms.field.fileKinds")}</legend>
        <Toggle
          label={t("forms.field.images")}
          checked={kinds.includes("images")}
          onCheckedChange={(on) => toggleKind("images", on)}
        />
        <Toggle
          label={t("forms.field.documents")}
          checked={kinds.includes("documents")}
          onCheckedChange={(on) => toggleKind("documents", on)}
        />
        {problem === "forms.problem.noFileKinds" && (
          <p className="text-footnote text-danger">{t(problem)}</p>
        )}
      </fieldset>
      <NumberPair
        first={{ label: "forms.field.maxMegabytes", value: options.maxMegabytes, min: 1, max: 25 }}
        second={{ label: "forms.field.maxFiles", value: options.maxFiles, min: 1, max: 10 }}
        onChange={(maxMegabytes, maxFiles) =>
          onChange({ maxMegabytes: maxMegabytes ?? 10, maxFiles: maxFiles ?? 1 })
        }
      />
      <p className="text-footnote text-label-secondary">{t("forms.field.filePrivacy")}</p>
    </div>
  );
}

interface NumberInput {
  label: StringKey;
  value: number | undefined;
  min?: number;
  max?: number;
}

function NumberPair({
  first,
  second,
  onChange,
}: {
  first: NumberInput;
  second: NumberInput;
  onChange: (first: number | undefined, second: number | undefined) => void;
}) {
  const read = (text: string) => (text.trim() === "" ? undefined : Number(text));
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField
        type="number"
        inputMode="decimal"
        label={t(first.label)}
        min={first.min}
        max={first.max}
        value={first.value ?? ""}
        onChange={(event) => onChange(read(event.target.value), second.value)}
      />
      <TextField
        type="number"
        inputMode="decimal"
        label={t(second.label)}
        min={second.min}
        max={second.max}
        value={second.value ?? ""}
        onChange={(event) => onChange(first.value, read(event.target.value))}
      />
    </div>
  );
}
