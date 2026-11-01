import { SelectField } from "../design/SelectField.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import type { Field, FieldOptions, FieldType } from "../fields/field.types.js";
import { numberFromInput } from "../fields/fieldValues.js";
import { t } from "../i18n/strings.js";
import { BlockTypesEditor } from "./BlockTypesEditor.js";
import { ChoicesEditor } from "./ChoicesEditor.js";
import { FieldsetOptions } from "./FieldsetOptions.js";
import { InnerFieldsEditor } from "./InnerFieldsEditor.js";
import { EntriesOptions, TermsOptions } from "./RelationOptions.js";
import { SwatchesEditor } from "./SwatchesEditor.js";

interface FieldTypeOptionsProps {
  field: Field;
  onChange: (options: FieldOptions) => void;
  /** For blocks: what is wrong with the block types, shown above them. */
  problem?: string;
  /** The fields beside this one, for "made from" (a slug). */
  siblings?: readonly Field[];
  /** The lists around this field, innermost first, for the conditions of fields inside it. */
  outerLevels?: readonly (readonly Field[])[];
}

/** Fieldtypes with settings of their own, shown in the Options tab. */
const typesWithOptions = new Set<FieldType>([
  "number",
  "select",
  "radio",
  "checkboxes",
  "buttonGroup",
  "range",
  "date",
  "slug",
  "code",
  "table",
  "colour",
  "terms",
  "entries",
  "blocks",
  "group",
  "repeater",
  "fieldset",
  "revealer",
]);

export function hasTypeOptions(type: FieldType): boolean {
  return typesWithOptions.has(type);
}

const codeLanguages = [
  "plain",
  "html",
  "css",
  "javascript",
  "typescript",
  "json",
  "yaml",
  "markdown",
  "php",
  "python",
  "shell",
  "sql",
] as const;

/** The settings that only some fieldtypes have: choices, a slider's range, the fields inside. */
export function FieldTypeOptions({
  field,
  onChange,
  problem,
  siblings = [],
  outerLevels = [],
}: FieldTypeOptionsProps) {
  const { options } = field;
  const set = (changes: FieldOptions) => onChange({ ...options, ...changes });
  const numberText = (value: number | undefined) => (value === undefined ? "" : String(value));
  const numberOption = (text: string) => numberFromInput(text) ?? undefined;

  switch (field.type) {
    case "number":
      return (
        <TextField
          label={t("builder.step")}
          hint={t("fieldOptions.stepHint")}
          type="number"
          min={0}
          value={numberText(options.step)}
          onChange={(event) => set({ step: numberOption(event.target.value) })}
          className="max-w-48"
        />
      );

    case "radio":
    case "checkboxes":
      return (
        <div className="flex flex-col gap-4">
          <Toggle
            label={t("fieldOptions.inline")}
            checked={options.inline === true}
            onCheckedChange={(inline) => set({ inline })}
          />
          <ChoicesEditor choices={options.choices ?? []} onChange={(choices) => set({ choices })} />
        </div>
      );

    case "buttonGroup":
      return (
        <ChoicesEditor choices={options.choices ?? []} onChange={(choices) => set({ choices })} />
      );

    case "range":
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField
            label={t("builder.min")}
            type="number"
            value={numberText(options.min ?? 0)}
            onChange={(event) => set({ min: numberOption(event.target.value) ?? 0 })}
          />
          <TextField
            label={t("builder.max")}
            type="number"
            value={numberText(options.max ?? 100)}
            onChange={(event) => set({ max: numberOption(event.target.value) ?? 100 })}
          />
          <TextField
            label={t("builder.step")}
            type="number"
            min={0}
            value={numberText(options.step ?? 1)}
            onChange={(event) => set({ step: numberOption(event.target.value) ?? 1 })}
          />
          <TextField
            label={t("fieldOptions.suffix")}
            value={options.suffix ?? ""}
            onChange={(event) => set({ suffix: event.target.value })}
          />
        </div>
      );

    case "slug": {
      const sources = siblings.filter(
        (sibling) =>
          sibling.handle !== field.handle &&
          (sibling.type === "text" || sibling.type === "textarea"),
      );
      return (
        <SelectField
          label={t("fieldOptions.slugFrom")}
          hint={t("fieldOptions.slugFromHint")}
          options={sources.map((source) => ({ value: source.handle, label: source.label }))}
          value={options.from ?? "title"}
          onValueChange={(from) => set({ from })}
          className="max-w-sm"
        />
      );
    }

    case "code":
      return (
        <SelectField
          label={t("fieldOptions.language")}
          options={codeLanguages.map((language) => ({ value: language, label: language }))}
          value={options.language ?? "plain"}
          onValueChange={(language) => set({ language })}
          className="max-w-xs"
        />
      );

    case "table":
      return (
        <div className="flex flex-col gap-4">
          <Toggle
            label={t("fieldOptions.headerRow")}
            checked={options.headerRow !== false}
            onCheckedChange={(headerRow) => set({ headerRow })}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("fieldOptions.maxRows")}
              hint={t("builder.maxLengthHint")}
              type="number"
              min={1}
              value={numberText(options.maxRows)}
              onChange={(event) => set({ maxRows: numberOption(event.target.value) })}
            />
            <TextField
              label={t("fieldOptions.maxColumns")}
              type="number"
              min={1}
              max={20}
              value={numberText(options.maxColumns)}
              onChange={(event) => set({ maxColumns: numberOption(event.target.value) })}
            />
          </div>
        </div>
      );

    case "group":
    case "repeater":
      return (
        <div className="flex flex-col gap-5">
          {field.type === "repeater" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField
                label={t("fieldOptions.minRows")}
                type="number"
                min={1}
                value={numberText(options.minRows)}
                onChange={(event) => set({ minRows: numberOption(event.target.value) })}
              />
              <TextField
                label={t("fieldOptions.maxRows")}
                type="number"
                min={1}
                value={numberText(options.maxRows)}
                onChange={(event) => set({ maxRows: numberOption(event.target.value) })}
              />
              <TextField
                label={t("fieldOptions.addLabel")}
                placeholder={t("fields.repeater.add")}
                value={options.addLabel ?? ""}
                onChange={(event) => set({ addLabel: event.target.value })}
              />
            </div>
          )}
          <InnerFieldsEditor
            ownerLabel={field.label}
            fields={options.fields ?? []}
            outerLevels={[siblings, ...outerLevels]}
            onChange={(fields) => set({ fields })}
          />
        </div>
      );

    case "fieldset":
      return <FieldsetOptions options={options} onChange={set} />;

    case "revealer":
      return (
        <TextField
          label={t("fieldOptions.buttonLabel")}
          placeholder={t("fields.revealer.show")}
          value={options.buttonLabel ?? ""}
          onChange={(event) => set({ buttonLabel: event.target.value })}
          className="max-w-sm"
        />
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

    case "colour":
      return (
        <SwatchesEditor
          swatches={options.swatches ?? []}
          onChange={(swatches) => set({ swatches })}
        />
      );

    case "terms":
      return <TermsOptions options={options} onChange={set} />;

    case "entries":
      return <EntriesOptions options={options} onChange={set} />;

    case "blocks":
      return (
        <div className="flex flex-col gap-5">
          <TextField
            label={t("builder.blocks.maxBlocks")}
            hint={t("builder.blocks.maxBlocksHint")}
            type="number"
            min={1}
            inputMode="numeric"
            value={numberText(options.maxBlocks)}
            onChange={(event) => set({ maxBlocks: numberOption(event.target.value) })}
            className="max-w-48"
          />
          <BlockTypesEditor
            blockTypes={options.blockTypes ?? []}
            onChange={(blockTypes) => set({ blockTypes })}
            problem={problem}
            outerLevels={[siblings, ...outerLevels]}
          />
        </div>
      );

    default:
      return null;
  }
}
