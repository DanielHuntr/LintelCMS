import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { findFieldtype } from "../fieldtypes/fieldtypes.registry.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import type { FieldRename } from "./field-renames.repository.js";
import { listFieldValues, replaceFieldValue } from "./field-changes.repository.js";

/**
 * Changing a field that entries already use. A type change or a removed choice used to be
 * accepted, and every entry holding an old value then couldn't be saved at all, not even a
 * change to another field (LINTEL-FUNC-008).
 *
 * Now each stored value is checked against the field as it will be. One that can be turned
 * into the new kind without losing anything (450 into "450", "450" into 450, one choice into
 * a list of one) is converted. If any still wouldn't fit, the change is refused, saying how
 * many entries hold such a value, with an example, so they can be changed first.
 *
 * Top-level fields only: values inside groups and blocks are left to the editor's own check.
 */
export async function convertChangedFieldValues(
  database: DatabaseOrTransaction,
  blueprintId: string,
  fields: { before: readonly FieldDefinition[]; after: readonly FieldDefinition[] },
  renames: readonly FieldRename[] = [],
): Promise<void> {
  const problems: Record<string, string> = {};
  for (const after of fields.after) {
    const renamedFrom = renames.find((rename) => rename.to === after.handle && !rename.within);
    const before = fields.before.find(
      (field) => field.handle === (renamedFrom?.from ?? after.handle),
    );
    if (!before || !changesWhatFits(before, after)) continue;
    const fieldtype = findFieldtype(after.type);
    if (!fieldtype) continue;
    const schema = fieldtype.buildValueSchema(after.options, after.label);

    const conversions = new Map<string, { value: unknown; entryIds: string[] }>();
    const misfits: unknown[] = [];
    for (const { entryId, value } of await listFieldValues(database, blueprintId, after.handle)) {
      if (isEmpty(value) || (await schema.safeParseAsync(value)).success) continue;
      const converted = convert(value);
      if (converted !== undefined && (await schema.safeParseAsync(converted)).success) {
        const key = JSON.stringify(converted);
        const group = conversions.get(key) ?? { value: converted, entryIds: [] };
        group.entryIds.push(entryId);
        conversions.set(key, group);
      } else {
        misfits.push(value);
      }
    }

    if (misfits.length > 0) {
      problems[after.handle] = describeMisfits(after.label, misfits);
      continue;
    }
    for (const { value, entryIds } of conversions.values()) {
      await replaceFieldValue(database, entryIds, after.handle, value);
    }
  }
  if (Object.keys(problems).length > 0) throw new InvalidFieldsError(problems);
}

/** A different type, or different options (choices, limits): stored values may no longer fit. */
function changesWhatFits(before: FieldDefinition, after: FieldDefinition): boolean {
  return (
    before.type !== after.type ||
    JSON.stringify(before.options ?? {}) !== JSON.stringify(after.options ?? {})
  );
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** The same value as another kind, when nothing is lost on the way. */
function convert(value: unknown): unknown {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.length === 1) return value[0];
  return undefined;
}

function describeMisfits(label: string, misfits: readonly unknown[]): string {
  const example = misfits[0];
  const shown = typeof example === "string" ? example : JSON.stringify(example);
  return misfits.length === 1
    ? `1 entry has a value ${label} can’t hold any more, such as “${shown}”. Change it first, or keep the field as it was.`
    : `${misfits.length} entries have a value ${label} can’t hold any more, such as “${shown}”. Change them first, or keep the field as it was.`;
}
