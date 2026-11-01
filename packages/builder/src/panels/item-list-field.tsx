import {
  bindableKinds,
  type BindableField,
  type EditableField,
  type ListOfItemsField,
} from "@lintel/builder-model";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { IconButton, inputClassName, Labelled } from "../ui/controls.js";
import type { ImagePicker } from "./content-fields.js";
import type { BindingScope } from "./data-sources.js";
import { FieldControl } from "./field-controls.js";

type Item = Record<string, unknown>;

/** The value at a dotted path ("image.alt", "cells.0"), for naming an item in the list. */
function valueAt(item: Item, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) => (value && typeof value === "object" ? (value as Item)[key] : undefined),
      item,
    );
}

/**
 * A list of items that each have their own fields: slides, plans, people. Each item folds
 * open (a native disclosure, so it works by keyboard and screen reader), and can be moved
 * up and down or removed.
 */
export function ItemListField({
  field,
  value,
  onChange,
  pickImage,
}: {
  field: ListOfItemsField;
  value: readonly Item[];
  onChange: (value: Item[]) => void;
  pickImage: ImagePicker | undefined;
}) {
  const text = useBuilderText();
  const items = value.slice();
  const replace = (index: number, item: Item) =>
    onChange(items.map((current, at) => (at === index ? item : current)));
  const move = (index: number, by: number) => {
    const next = items.slice();
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + by, 0, item);
    onChange(next);
  };
  const atLimit = field.maxItems !== undefined && items.length >= field.maxItems;
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1 text-caption text-label-secondary">{field.label}</legend>
      {items.map((item, index) => {
        const title = String(valueAt(item, field.titleField) ?? "").trim();
        const name =
          title ||
          text("pageBuilder.content.untitledItem", { name: field.itemLabel, number: index + 1 });
        return (
          <div key={index} className="relative rounded-control bg-fill">
            <div className="absolute top-1.5 inset-e-1 flex items-center">
              <IconButton
                size="small"
                icon={ArrowUp}
                label={text("pageBuilder.content.moveUp", { name })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                size="small"
                icon={ArrowDown}
                label={text("pageBuilder.content.moveDown", { name })}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                size="small"
                icon={Trash2}
                label={text("pageBuilder.content.remove", { name })}
                onClick={() => onChange(items.filter((_, at) => at !== index))}
              />
            </div>
            <details>
              <summary className="flex h-9 cursor-pointer list-none items-center pe-24 ps-2 text-footnote font-medium text-label focus-visible:focus-ring">
                <span className="min-w-0 flex-1 truncate">{name}</span>
              </summary>
              <div className="flex flex-col gap-3 px-2 pt-1 pb-3">
                {field.fields.map((subField) => (
                  <FieldControl
                    key={subField.prop}
                    field={subField}
                    value={item[subField.prop]}
                    pickImage={pickImage}
                    onChange={(next) => replace(index, { ...item, [subField.prop]: next })}
                  />
                ))}
              </div>
            </details>
          </div>
        );
      })}
      <button
        type="button"
        disabled={atLimit}
        onClick={() => onChange([...items, structuredClone({ ...field.newItem })])}
        className="flex h-7 items-center gap-1 self-start rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring disabled:opacity-40"
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.content.addItem", { name: field.itemLabel.toLowerCase() })}
      </button>
    </fieldset>
  );
}

/**
 * "Shows: What I type here / Entry: Title / ..." above a field that can show a field of
 * the current entry, offering only the entry's fields that suit it.
 */
export function BindingPicker({
  field,
  scope,
  boundTo,
  onChange,
}: {
  field: EditableField;
  scope: BindingScope;
  boundTo: string | undefined;
  onChange: (fieldPath: string | null) => void;
}) {
  const text = useBuilderText();
  const kinds = bindableKinds(field);
  const fields: readonly BindableField[] = scope.fields.filter((candidate) =>
    kinds.includes(candidate.kind),
  );
  if (fields.length === 0) return null;
  const bound = fields.find((candidate) => candidate.path === boundTo);
  return (
    <div className="flex flex-col gap-1">
      <Labelled label={`${field.label}: ${text("pageBuilder.content.bind.label")}`}>
        {(id) => (
          <select
            id={id}
            value={boundTo ?? ""}
            onChange={(event) => onChange(event.target.value || null)}
            className={inputClassName}
          >
            <option value="">{text("pageBuilder.content.bind.typed")}</option>
            {fields.map((candidate) => (
              <option key={candidate.path} value={candidate.path}>
                {text("pageBuilder.content.bind.field", {
                  scope: scope.name,
                  field: candidate.label,
                })}
              </option>
            ))}
          </select>
        )}
      </Labelled>
      {bound && (
        <p className="text-caption text-label-secondary">
          {text("pageBuilder.content.bind.note", { field: bound.label.toLowerCase() })}
        </p>
      )}
    </div>
  );
}
