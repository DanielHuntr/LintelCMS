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
  | { type: "fieldAdded"; key: string; fieldType: FieldType; label: string }
  | {
      type: "fieldChanged";
      key: string;
      changes: Partial<Pick<Field, "label" | "required" | "helpText">>;
    }
  | { type: "fieldOptionsChanged"; key: string; options: FieldOptions }
  | { type: "handleEdited"; key: string; handle: string }
  | { type: "fieldMovedBy"; key: string; direction: -1 | 1 }
  | { type: "fieldMovedTo"; key: string; targetKey: string }
  | { type: "fieldRemoved"; key: string }
  | { type: "loaded"; blueprint: Blueprint };

export function draftFromBlueprint(blueprint: Blueprint): BlueprintDraftState {
  return {
    name: blueprint.name,
    fields: blueprint.fields.map((field) => ({
      ...field,
      options: withDraftOptions(field.options ?? {}),
      key: `saved:${field.handle}`,
      handleIsCustom: true,
      isSaved: true,
    })),
  };
}

/** A blocks field's block types get the builder's bookkeeping; other options stay as they are. */
function withDraftOptions(options: FieldOptions): FieldOptions {
  return options.blockTypes
    ? { ...options, blockTypes: withDraftKeys(options.blockTypes) }
    : options;
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
      return { ...state, fields: [...state.fields, field] };
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

function defaultOptionsFor(fieldType: FieldType): FieldOptions {
  if (fieldType === "select") return { choices: [], multiple: false };
  if (fieldType === "blocks") return { blockTypes: [] };
  return {};
}

/** Keeps only the options that apply to the field's type, so the API gets a clean blueprint. */
export function optionsForType(fieldType: FieldType, options: FieldOptions): FieldOptions {
  const pick = (keys: Array<keyof FieldOptions>): FieldOptions =>
    Object.fromEntries(
      keys.filter((key) => options[key] !== undefined).map((key) => [key, options[key]]),
    );

  switch (fieldType) {
    case "text":
    case "textarea":
      return pick(["maxLength"]);
    case "number":
      return pick(["min", "max", "step"]);
    case "select":
      return { choices: options.choices ?? [], multiple: options.multiple === true };
    case "date":
      return { includeTime: options.includeTime === true };
    case "blocks":
      return {
        blockTypes: blockTypesForSaving(options.blockTypes ?? [], optionsForType),
        ...(options.maxBlocks !== undefined ? { maxBlocks: options.maxBlocks } : {}),
      };
    default:
      return {};
  }
}

/** The fields as the API takes them. */
export function fieldsForSaving(fields: readonly DraftField[]): Field[] {
  return fields.map(({ handle, label, type, required, helpText, options }) => ({
    handle,
    label: label.trim(),
    type,
    // The title is always required; the API insists, and the editor relies on it.
    required: handle === titleFieldHandle ? true : required,
    ...(helpText?.trim() ? { helpText: helpText.trim() } : {}),
    options: optionsForType(type, options),
  }));
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
    else if (field.type === "select" && (field.options.choices ?? []).length === 0) {
      problems[field.key] = t("builder.problem.choices");
    } else if (field.type === "blocks") {
      const problem = blockTypesProblem(field.options.blockTypes ?? []);
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
