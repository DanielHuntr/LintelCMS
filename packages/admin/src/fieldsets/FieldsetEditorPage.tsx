import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useReducer, useState } from "react";
import { ApiError, type FieldMessages } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import {
  blueprintDraftReducer,
  blueprintProblems,
  draftFromFields,
  fieldsForSaving,
  problemsByKey,
} from "../content-types/blueprintDraft.js";
import { blueprintKeys } from "../content-types/blueprints.queries.js";
import { FieldsBuilder } from "../content-types/FieldsBuilder.js";
import { useCanChangeContentModel } from "../content-model-sync/contentModelSync.queries.js";
import { ManagedInCodeBanner } from "../content-model-sync/ManagedInCodeBanner.js";
import { isSameValue } from "../content/sameValue.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { deleteFieldset, type Fieldset, updateFieldset } from "./fieldsets.api.js";
import { fieldsetKeys, useFieldset } from "./fieldsets.queries.js";

/** /settings/fieldsets/:handle: a fieldset's name and fields, built like a content type's. */
export function FieldsetEditorPage({ handle }: { handle: string }) {
  const fieldset = useFieldset(handle);
  return (
    <Page width="readable">
      {fieldset.isError && (
        <LoadError error={fieldset.error} onRetry={() => void fieldset.refetch()} />
      )}
      {fieldset.isPending && (
        <LoadingRegion label={t("fieldsets.loading")}>
          <Skeleton className="mb-10 h-10 w-56" />
          <Skeleton className="h-72 rounded-card" />
        </LoadingRegion>
      )}
      {fieldset.data && <FieldsetEditor key={fieldset.data.updatedAt} fieldset={fieldset.data} />}
    </Page>
  );
}

function FieldsetEditor({ fieldset }: { fieldset: Fieldset }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canEdit = useCanChangeContentModel("blueprints:update");
  const [saved, setSaved] = useState(() => draftFromFields(fieldset.name, fieldset.fields));
  const [state, dispatch] = useReducer(blueprintDraftReducer, saved);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<FieldMessages>({});
  const [hasTriedToSave, setHasTriedToSave] = useState(false);
  const isUnsaved = !isSameValue(saved, state);
  const leaveWarning = useLeaveWarning(isUnsaved);
  const problems = hasTriedToSave
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
      const updated = await updateFieldset(fieldset.handle, {
        name: state.name.trim(),
        fields: fieldsForSaving(state.fields),
      });
      queryClient.setQueryData(fieldsetKeys.fieldset(updated.handle), updated);
      void queryClient.invalidateQueries({ queryKey: fieldsetKeys.fieldsets() });
      // Content types using it have new fields now.
      void queryClient.invalidateQueries({ queryKey: blueprintKeys.blueprints() });
      const fresh = draftFromFields(updated.name, updated.fields);
      setSaved(fresh);
      dispatch({ type: "reset", draft: fresh });
      setServerProblems({});
      setHasTriedToSave(false);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setServerProblems(problemsByKey(state.fields, error.fields));
      }
      setSaveError(describeError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await deleteFieldset(fieldset.handle);
      await queryClient.invalidateQueries({ queryKey: fieldsetKeys.fieldsets() });
      await navigate({ to: "/settings/fieldsets", ignoreBlocker: true });
    } catch (error) {
      setSaveError(describeError(error));
      setIsDeleting(false);
    }
  }

  return (
    <>
      <BackLink to="/settings/fieldsets">{t("fieldsets.title")}</BackLink>
      <LargeTitle
        title={state.name.trim() || fieldset.name}
        subtitle={[
          t("builder.fieldCount", { count: state.fields.length }),
          fieldset.usedBy.length > 0
            ? t("fieldsets.usedBy", { names: fieldset.usedBy.join(", ") })
            : t("fieldsets.unused"),
        ].join(" · ")}
        actions={
          canEdit && (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={() => setIsDeleting(true)}>
                {t("fieldsets.delete")}
              </Button>
              <Button onClick={() => void save()} disabled={isSaving || !isUnsaved}>
                {isSaving ? t("builder.saving") : t("builder.save")}
              </Button>
            </div>
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
            label={t("fieldsets.name")}
            hint={t("fieldsets.nameHint")}
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
          removeMessage={t("fieldsets.removeFieldMessage")}
          canShowInList={false}
        />
      </div>
      <ConfirmDialog
        open={isDeleting}
        title={t("fieldsets.deleteTitle", { name: fieldset.name })}
        message={t("fieldsets.deleteMessage")}
        confirmLabel={t("fieldsets.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setIsDeleting(false)}
        onConfirm={() => void confirmDelete()}
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
