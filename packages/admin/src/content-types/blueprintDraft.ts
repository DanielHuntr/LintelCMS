import type { FieldMessages } from "../api/client.js";
import {
  titleFieldHandle,
  type Field,
  type FieldOptions,
  type FieldType,
  type SelectChoice,
} from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import type { Blueprint } from "./blueprints.types.js";
import { blockTypesForSaving, blockTypesProblem, withDraftKeys } from "./blockTypesDraft.js";
import {
  defaultOptionsFor,
  hasChoices,
  holdsFields,
  settingsForSaving,
  settingsProblem,
} from "./fieldSettingsDraft.js";
import { cleanTypedHandle, handleFromLabel, isValidHandle, uniqueHandle } from "./handle.js";

/**
 * The blueprint builder's state, as a reducer so its rules are plain, testable functions.
 *
 * Each field gets a `key` that never changes, because its handle can be edited.
 * The title field is always first: it can be relabelled, but not moved or removed.
 */

export interface DraftField extends Field {
  key: string;
  /** False while the handle is still made from the label. */
  handleIsCustom: boolean;
  /** Fields that came from the API already have content saved under their handle. */
  isSaved: boolean;
}

export interface BlueprintDraftState {
  name: string;
  fields: DraftField[];
}

export type BlueprintDraftAction =
  | { type: "renamed"; name: string }
  | {
      type: "fieldAdded";
      key: string;
      fieldType: FieldType;
      label: string;
      /** Put it after this field (the last one of the tab being looked at); otherwise at the end. */
      afterKey?: string;
    }
  | { type: "fieldChanged"; key: string; changes: FieldChanges }
  | { type: "fieldOptionsChanged"; key: string; options: FieldOptions }
  | { type: "handleEdited"; key: string; handle: string }
  | { type: "fieldMovedBy"; key: string; direction: -1 | 1 }
  | { type: "fieldMovedTo"; key: string; targetKey: string }
  | { type: "fieldRemoved"; key: string }
  | { type: "loaded"; blueprint: Blueprint }
  | { type: "reset"; draft: BlueprintDraftState };

/** What the settings dialog can change on a field, besides its handle, type and options. */
export type FieldChanges = Partial<Omit<Field, "handle" | "type" | "options" | "draft">>;

export function draftFromBlueprint(blueprint: Blueprint): BlueprintDraftState {
  return draftFromFields(blueprint.name, blueprint.fields);
}

/** The builder's state for any named list of fields, such as a global set's. */
export function draftFromFields(name: string, fields: readonly Field[]): BlueprintDraftState {
  return {
    name,
    fields: fields.map((field) => ({
      ...field,
      options: withDraftOptions(field.options ?? {}),
      key: `saved:${field.handle}`,
      handleIsCustom: true,
      isSaved: true,
    })),
  };
}

/**
 * A blocks field's block types, and a group's or repeater's fields, get the builder's
 * bookkeeping; other options stay as they are.
 */
export function withDraftOptions(options: FieldOptions): FieldOptions {
  let result = options;
  if (options.blockTypes) {
    result = {
      ...result,
      blockTypes: withDraftKeys(options.blockTypes).map((blockType) => ({
        ...blockType,
        fields: blockType.fields.map((field) => ({
          ...field,
          options: withDraftOptions(field.options),
        })),
      })),
    };
  }
  if (options.fields) {
    result = {
      ...result,
      fields: options.fields.map((field) => ({
        ...field,
        options: withDraftOptions(field.options ?? {}),
        draft: field.draft ?? { key: `saved:${field.handle}`, handleFollows: false },
      })),
    };
  }
  return result;
}

export function isTitleField(field: Pick<Field, "handle">): boolean {
  return field.handle === titleFieldHandle;
}

export function blueprintDraftReducer(
  state: BlueprintDraftState,
  action: BlueprintDraftAction,
): BlueprintDraftState {
  switch (action.type) {
    case "renamed":
      return { ...state, name: action.name };

    case "fieldAdded": {
      const handle = uniqueHandle(
        handleFromLabel(action.label) || "field",
        handlesOf(state.fields),
      );
      const field: DraftField = {
        key: action.key,
        handle,
        label: action.label,
        type: action.fieldType,
        required: false,
        options: defaultOptionsFor(action.fieldType),
        handleIsCustom: false,
        isSaved: false,
      };
      const after = state.fields.findIndex((other) => other.key === action.afterKey);
      if (after === -1) return { ...state, fields: [...state.fields, field] };
      const fields = [...state.fields];
      fields.splice(after + 1, 0, field);
      return { ...state, fields };
    }

    case "fieldChanged":
      return updateField(state, action.key, (field) => {
        const updated = { ...field, ...action.changes };
        if (action.changes.label === undefined || field.handleIsCustom || isTitleField(field)) {
          return updated;
        }
        const others = handlesOf(state.fields.filter((other) => other.key !== field.key));
        return {
          ...updated,
          handle: uniqueHandle(handleFromLabel(action.changes.label) || "field", others),
        };
      });

    case "fieldOptionsChanged":
      return updateField(state, action.key, (field) => ({ ...field, options: action.options }));

    case "handleEdited":
      return updateField(state, action.key, (field) => {
        if (isTitleField(field)) return field;
        const handle = cleanTypedHandle(action.handle);
        // Clearing the handle hands it back to the label.
        return handle === ""
          ? { ...field, handle: handleFromLabel(field.label), handleIsCustom: false }
          : { ...field, handle, handleIsCustom: true };
      });

    case "fieldMovedBy": {
      const index = state.fields.findIndex((field) => field.key === action.key);
      const target = state.fields[index + action.direction];
      return target ? moveField(state, action.key, target.key) : state;
    }

    case "fieldMovedTo":
      return moveField(state, action.key, action.targetKey);

    case "fieldRemoved":
      return {
        ...state,
        fields: state.fields.filter((field) => field.key !== action.key || isTitleField(field)),
      };

    case "loaded":
      return draftFromBlueprint(action.blueprint);

    case "reset":
      return action.draft;
  }
}

/** Moves a field to where another one is. Nothing moves into, or out of, the title's place. */
function moveField(
  state: BlueprintDraftState,
  key: string,
  targetKey: string,
): BlueprintDraftState {
  const from = state.fields.findIndex((field) => field.key === key);
  const to = state.fields.findIndex((field) => field.key === targetKey);
  const moving = state.fields[from];
  const target = state.fields[to];
  if (!moving || !target || from === to || isTitleField(moving) || isTitleField(target)) {
    return state;
  }
  const fields = [...state.fields];
  fields.splice(from, 1);
  fields.splice(to, 0, moving);
  return { ...state, fields };
}

function updateField(
  state: BlueprintDraftState,
  key: string,
  update: (field: DraftField) => DraftField,
): BlueprintDraftState {
  return {
    ...state,
    fields: state.fields.map((field) => (field.key === key ? update(field) : field)),
  };
}

function handlesOf(fields: readonly DraftField[]): string[] {
  return fields.map((field) => field.handle);
}

/** Keeps only the options that apply to the field's type, so the API gets a clean blueprint. */
export function optionsForType(fieldType: FieldType, options: FieldOptions): FieldOptions {
  const pick = (keys: Array<keyof FieldOptions>): FieldOptions =>
    Object.fromEntries(
      keys.filter((key) => options[key] !== undefined).map((key) => [key, options[key]]),
    );

  if (hasChoices(fieldType) && fieldType !== "select") {
    return { choices: options.choices ?? [], ...pick(["inline"]) };
  }
  if (holdsFields(fieldType)) {
    return {
      fields: innerFieldsForSaving(options.fields ?? []),
      ...pick(["minRows", "maxRows", "addLabel"]),
    };
  }
  switch (fieldType) {
    case "text":
    case "textarea":
      return pick(["maxLength"]);
    case "range":
      return pick(["min", "max", "step", "suffix"]);
    case "slug":
      return pick(["from"]);
    case "code":
      return pick(["language", "maxLength"]);
    case "table":
      return pick(["headerRow", "maxRows", "maxColumns"]);
    case "users":
      return pick(["maxItems"]);
    case "revealer":
      return pick(["buttonLabel"]);
    case "fieldset":
      // The fieldset's fields are filled in by the API.
      return { fieldset: options.fieldset ?? "" };
    case "number":
      return pick(["min", "max", "step"]);
    case "select":
      return { choices: options.choices ?? [], multiple: options.multiple === true };
    case "date":
      return { includeTime: options.includeTime === true };
    case "markdown":
      return pick(["maxLength"]);
    case "list":
      return pick(["maxItems"]);
    case "colour":
      return { swatches: options.swatches ?? [] };
    case "entries":
      return { collections: options.collections ?? [], ...pick(["maxItems"]) };
    case "terms":
      return { taxonomy: options.taxonomy ?? "", ...pick(["maxItems"]) };
    case "blocks":
      return {
        blockTypes: blockTypesForSaving(options.blockTypes ?? [], fieldForSaving),
        ...(options.maxBlocks !== undefined ? { maxBlocks: options.maxBlocks } : {}),
      };
    default:
      return {};
  }
}

/** The fields as the API takes them. */
/**
 * The saved fields whose handle was changed, as `{ from, to }`: the API moves entries'
 * content to the new handle. A saved field's key is `saved:` and the handle it was saved with.
 */
export function handleRenames(fields: readonly DraftField[]): Array<{ from: string; to: string }> {
  return fields.flatMap((field) => {
    const from = field.isSaved && field.key.startsWith("saved:") ? field.key.slice(6) : null;
    return from !== null && from !== field.handle ? [{ from, to: field.handle }] : [];
  });
}

export function fieldsForSaving(fields: readonly DraftField[]): Field[] {
  return fields.map((field) => ({
    ...fieldForSaving(field),
    // The title is always required; the API insists, and the editor relies on it.
    required: field.handle === titleFieldHandle ? true : field.required,
  }));
}

/** One field as the API takes it, without the builder's bookkeeping. */
export function fieldForSaving(field: Field): Field {
  const { handle, label, type, required, helpText, options } = field;
  return {
    handle,
    label: label.trim(),
    type,
    required,
    ...(helpText?.trim() ? { helpText: helpText.trim() } : {}),
    ...settingsForSaving(field),
    options: optionsForType(type, options),
  };
}

/** The fields inside a group or repeater, as the API takes them. */
function innerFieldsForSaving(fields: readonly Field[]): Field[] {
  return fields.map(fieldForSaving);
}

/**
 * Problems to fix before saving, keyed by field `key` (and "name" for the content type's name).
 * The API checks the same things; checking here first means instant, specific messages.
 */
export function blueprintProblems(state: BlueprintDraftState): FieldMessages {
  const problems: Record<string, string> = {};
  if (state.name.trim() === "") problems.name = t("builder.problem.name");

  const handleCounts = new Map<string, number>();
  for (const field of state.fields) {
    handleCounts.set(field.handle, (handleCounts.get(field.handle) ?? 0) + 1);
  }

  for (const field of state.fields) {
    if (field.label.trim() === "") problems[field.key] = t("builder.problem.label");
    else if (!isValidHandle(field.handle)) problems[field.key] = t("builder.problem.handle");
    else if ((handleCounts.get(field.handle) ?? 0) > 1)
      problems[field.key] = t("builder.problem.duplicate");
    else if (field.type === "terms" && !field.options.taxonomy) {
      problems[field.key] = t("builder.problem.taxonomy");
    } else if (field.type === "blocks") {
      const problem = blockTypesProblem(field.options.blockTypes ?? []);
      if (problem) problems[field.key] = problem;
    } else {
      const problem = settingsProblem(field, state.fields);
      if (problem) problems[field.key] = problem;
    }
  }
  return problems;
}

/** The API reports field problems by handle; the builder shows them by key. */
export function problemsByKey(
  fields: readonly DraftField[],
  byHandle: FieldMessages,
): FieldMessages {
  const problems: Record<string, string> = {};
  for (const [handle, message] of Object.entries(byHandle)) {
    const field = fields.find((candidate) => candidate.handle === handle);
    problems[field ? field.key : handle] = message;
  }
  return problems;
}

/** Renames a choice. Its stored value follows the label unless it was set by hand. */
export function renameChoice(choice: SelectChoice, label: string): SelectChoice {
  const valueFollowsLabel =
    choice.value === "" || choice.value === handleFromLabel(choice.label, "choice");
  return { label, value: valueFollowsLabel ? handleFromLabel(label, "choice") : choice.value };
}
