import { useState } from "react";
import type { FieldMessages } from "../api/client.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { t } from "../i18n/strings.js";
import { AddFieldDialog } from "./AddFieldDialog.js";
import type { BlueprintDraftAction, DraftField } from "./blueprintDraft.js";
import { useFieldtypes } from "./blueprints.queries.js";
import { FieldLayoutCanvas } from "./FieldLayoutCanvas.js";
import { FieldSettingsSheet } from "./FieldSettingsSheet.js";

interface FieldsBuilderProps {
  fields: readonly DraftField[];
  problems: FieldMessages;
  canEdit: boolean;
  dispatch: (action: BlueprintDraftAction) => void;
  /** What removing a saved field does to content, for the confirmation. */
  removeMessage: string;
  /** Only a content type's own fields can be columns in its list of entries. */
  canShowInList: boolean;
}

/**
 * Everything for arranging a list of fields, shared by content types, global sets and
 * fieldsets: the canvas, "Add a field", each field's settings, and confirming the removal
 * of a field that may already hold content.
 */
export function FieldsBuilder({
  fields,
  problems,
  canEdit,
  dispatch,
  removeMessage,
  canShowInList,
}: FieldsBuilderProps) {
  const fieldtypes = useFieldtypes();
  // Where "Add a field" puts the new field: after this one, or (undefined) at the end.
  const [addingAfter, setAddingAfter] = useState<string | undefined | null>(null);
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
  const [fieldToRemove, setFieldToRemove] = useState<DraftField | null>(null);
  const typeNameOf = (type: string) =>
    fieldtypes.data?.find((fieldtype) => fieldtype.type === type)?.name ?? type;
  const settingsField = fields.find((field) => field.key === settingsKey) ?? null;

  function addField(type: DraftField["type"], name: string, afterKey?: string) {
    const key = crypto.randomUUID();
    dispatch({ type: "fieldAdded", key, fieldType: type, label: name, afterKey });
    setAddingAfter(null);
    setSettingsKey(key);
  }

  function removeField(field: DraftField) {
    setSettingsKey(null);
    // A field that's never been saved has no content yet, so there's nothing to confirm.
    if (field.isSaved) setFieldToRemove(field);
    else dispatch({ type: "fieldRemoved", key: field.key });
  }

  return (
    <>
      <FieldLayoutCanvas
        fields={fields}
        problems={problems}
        canEdit={canEdit}
        typeNameOf={typeNameOf}
        dispatch={dispatch}
        onOpenSettings={setSettingsKey}
        onRemove={removeField}
        onAddField={(afterKey) => setAddingAfter(afterKey)}
        onAddTab={() => addField("tab", t("builder.newTab"))}
      />
      <AddFieldDialog
        open={addingAfter !== null}
        onClose={() => setAddingAfter(null)}
        onPick={(type, name) => addField(type, name, addingAfter ?? undefined)}
      />
      <FieldSettingsSheet
        field={settingsField}
        fields={fields}
        typeName={settingsField ? typeNameOf(settingsField.type) : ""}
        problem={settingsField ? problems[settingsField.key] : undefined}
        canShowInList={canShowInList}
        dispatch={dispatch}
        onRemove={removeField}
        onClose={() => setSettingsKey(null)}
      />
      <ConfirmDialog
        open={fieldToRemove !== null}
        title={t("builder.removeTitle", { label: fieldToRemove?.label ?? "" })}
        message={removeMessage}
        confirmLabel={t("builder.remove")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setFieldToRemove(null)}
        onConfirm={() => {
          if (fieldToRemove) dispatch({ type: "fieldRemoved", key: fieldToRemove.key });
          setFieldToRemove(null);
        }}
      />
    </>
  );
}
