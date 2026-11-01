import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useReducer, useState } from "react";
import { ApiError, type FieldMessages } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { isSameValue } from "../content/sameValue.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { useCanChangeContentModel } from "../content-model-sync/contentModelSync.queries.js";
import { ManagedInCodeBanner } from "../content-model-sync/ManagedInCodeBanner.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { AddFieldSheet } from "./AddFieldSheet.js";
import {
  blueprintDraftReducer,
  blueprintProblems,
  draftFromBlueprint,
  fieldsForSaving,
  problemsByKey,
  type DraftField,
} from "./blueprintDraft.js";
import { BlueprintFieldList } from "./BlueprintFieldList.js";
import { updateBlueprint } from "./blueprints.api.js";
import { blueprintKeys, useFieldtypes } from "./blueprints.queries.js";
import type { Blueprint } from "./blueprints.types.js";
import { FieldSettingsSheet } from "./FieldSettingsSheet.js";

/** The blueprint builder: a content type's name and its ordered list of fields. */
export function BlueprintEditor({ blueprint }: { blueprint: Blueprint }) {
  const queryClient = useQueryClient();
  const canEdit = useCanChangeContentModel("blueprints:update");
  const fieldtypes = useFieldtypes();
  const [saved, setSaved] = useState(() => draftFromBlueprint(blueprint));
  const [state, dispatch] = useReducer(blueprintDraftReducer, saved);
  const [isAddingField, setIsAddingField] = useState(false);
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
  const [fieldToRemove, setFieldToRemove] = useState<DraftField | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [serverProblems, setServerProblems] = useState<FieldMessages>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasTriedToSave, setHasTriedToSave] = useState(false);

  const isUnsaved = !isSameValue(saved, state);
  const leaveWarning = useLeaveWarning(isUnsaved);
  // Problems appear once someone tries to save, not while they're still typing a new field.
  const problems: FieldMessages = hasTriedToSave
    ? { ...blueprintProblems(state), ...serverProblems }
    : serverProblems;
  const typeNameOf = (type: string) =>
    fieldtypes.data?.find((fieldtype) => fieldtype.type === type)?.name ?? type;
  const settingsField = state.fields.find((field) => field.key === settingsKey) ?? null;

  async function save() {
    setHasTriedToSave(true);
    setSaveError(null);
    if (Object.keys(blueprintProblems(state)).length > 0) {
      setSaveError(t("builder.fixProblems"));
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateBlueprint(blueprint.handle, {
        name: state.name.trim(),
        fields: fieldsForSaving(state.fields),
      });
      queryClient.setQueryData(blueprintKeys.blueprint(updated.handle), updated);
      void queryClient.invalidateQueries({ queryKey: blueprintKeys.blueprints() });
      // Entries opened from now on use the new fields.
      void queryClient.invalidateQueries({ queryKey: ["entries"] });
      const fresh = draftFromBlueprint(updated);
      setSaved(fresh);
      dispatch({ type: "loaded", blueprint: updated });
      setServerProblems({});
      setHasTriedToSave(false);
    } catch (error) {
      if (error instanceof ApiError && error.fields)
        setServerProblems(problemsByKey(state.fields, error.fields));
      setSaveError(describeError(error));
    } finally {
      setIsSaving(false);
    }
  }

  function addField(type: DraftField["type"], name: string) {
    const key = crypto.randomUUID();
    dispatch({ type: "fieldAdded", key, fieldType: type, label: name });
    setIsAddingField(false);
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
      <BackLink to="/settings/content-types">{t("contentTypes.title")}</BackLink>
      <LargeTitle
        title={state.name.trim() || blueprint.name}
        subtitle={t("builder.fieldCount", { count: state.fields.length })}
        actions={
          canEdit && (
            <Button onClick={() => void save()} disabled={isSaving || !isUnsaved}>
              {isSaving ? t("builder.saving") : t("builder.save")}
            </Button>
          )
        }
      />
      <ManagedInCodeBanner />

      {saveError && (
        <p
          role="alert"
          className="mb-6 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          {saveError}
        </p>
      )}

      <div className="flex flex-col gap-8">
        <section className="rounded-card bg-surface p-5">
          <TextField
            label={t("builder.name")}
            hint={t("builder.nameHint")}
            value={state.name}
            error={problems.name}
            onChange={(event) => dispatch({ type: "renamed", name: event.target.value })}
            className="max-w-md"
          />
        </section>

        <section aria-labelledby="blueprint-fields-heading" className="flex flex-col gap-2">
          <div className="flex items-end justify-between px-1">
            <div>
              <h2 id="blueprint-fields-heading" className="text-headline text-label">
                {t("builder.fields")}
              </h2>
              <p className="text-footnote text-label-secondary">{t("builder.fieldsHint")}</p>
            </div>
            {canEdit && (
              <Button
                variant="tinted"
                size="small"
                icon={<Plus aria-hidden="true" />}
                onClick={() => setIsAddingField(true)}
              >
                {t("builder.addField")}
              </Button>
            )}
          </div>
          <BlueprintFieldList
            fields={state.fields}
            problems={problems}
            typeNameOf={typeNameOf}
            onMoveBy={(key, direction) => dispatch({ type: "fieldMovedBy", key, direction })}
            onMoveTo={(key, targetKey) => dispatch({ type: "fieldMovedTo", key, targetKey })}
            onOpenSettings={setSettingsKey}
            onRemove={removeField}
          />
        </section>
      </div>

      <AddFieldSheet
        open={isAddingField}
        onClose={() => setIsAddingField(false)}
        onPick={addField}
      />
      <FieldSettingsSheet
        field={settingsField}
        typeName={settingsField ? typeNameOf(settingsField.type) : ""}
        problem={settingsField ? problems[settingsField.key] : undefined}
        dispatch={dispatch}
        onRemove={removeField}
        onClose={() => setSettingsKey(null)}
      />
      <ConfirmDialog
        open={fieldToRemove !== null}
        title={t("builder.removeTitle", { label: fieldToRemove?.label ?? "" })}
        message={t("builder.removeMessage")}
        confirmLabel={t("builder.remove")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setFieldToRemove(null)}
        onConfirm={() => {
          if (fieldToRemove) dispatch({ type: "fieldRemoved", key: fieldToRemove.key });
          setFieldToRemove(null);
        }}
      />
      <ConfirmDialog
        open={leaveWarning.isAsking}
        title={t("editor.leaveTitle")}
        message={t("builder.leaveMessage")}
        confirmLabel={t("editor.leave")}
        cancelLabel={t("editor.stay")}
        isDestructive
        onCancel={leaveWarning.stay}
        onConfirm={leaveWarning.leave}
      />
    </>
  );
}
