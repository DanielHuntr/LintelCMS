import { useQueryClient } from "@tanstack/react-query";
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
import { t, tCount } from "../i18n/strings.js";
import {
  blueprintDraftReducer,
  blueprintProblems,
  draftFromBlueprint,
  fieldsForSaving,
  problemsByKey,
} from "./blueprintDraft.js";
import { FieldsBuilder } from "./FieldsBuilder.js";
import { updateBlueprint } from "./blueprints.api.js";
import { blueprintKeys } from "./blueprints.queries.js";
import type { Blueprint } from "./blueprints.types.js";

/** The blueprint builder: a content type's name and its ordered list of fields. */
export function BlueprintEditor({ blueprint }: { blueprint: Blueprint }) {
  const queryClient = useQueryClient();
  const canEdit = useCanChangeContentModel("blueprints:update");
  const [saved, setSaved] = useState(() => draftFromBlueprint(blueprint));
  const [state, dispatch] = useReducer(blueprintDraftReducer, saved);
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

  return (
    <>
      <BackLink to="/settings/content-types">{t("contentTypes.title")}</BackLink>
      <LargeTitle
        title={state.name.trim() || blueprint.name}
        subtitle={tCount(
          { one: "builder.fieldCount.one", other: "builder.fieldCount.other" },
          state.fields.length,
        )}
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

        <FieldsBuilder
          fields={state.fields}
          problems={problems}
          canEdit={canEdit}
          dispatch={dispatch}
          removeMessage={t("builder.removeMessage")}
          canShowInList
        />
      </div>

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
