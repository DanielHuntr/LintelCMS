import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useReducer, useState } from "react";
import { ApiError, type FieldMessages } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import {
  blueprintDraftReducer,
  blueprintProblems,
  draftFromFields,
  fieldsForSaving,
  problemsByKey,
} from "../content-types/blueprintDraft.js";
import { FieldsBuilder } from "../content-types/FieldsBuilder.js";
import { isSameValue } from "../content/sameValue.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { ManagedInCodeBanner } from "../content-model-sync/ManagedInCodeBanner.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { TextField } from "../design/TextField.js";
import { t, tCount } from "../i18n/strings.js";
import { deleteGlobalSet, updateGlobalSet } from "./globals.api.js";
import { globalKeys } from "./globals.queries.js";
import type { GlobalSet } from "./globals.types.js";

/**
 * A global set's name and fields, built with the same pieces as a content type. Unlike a
 * content type it has no title field: every field is the editor's to arrange.
 */
export function GlobalFieldsEditor({ globalSet }: { globalSet: GlobalSet }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => draftFromFields(globalSet.name, globalSet.fields));
  const [state, dispatch] = useReducer(blueprintDraftReducer, saved);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [serverProblems, setServerProblems] = useState<FieldMessages>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasTriedToSave, setHasTriedToSave] = useState(false);

  const isUnsaved = !isSameValue(saved, state);
  const leaveWarning = useLeaveWarning(isUnsaved);
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
      const updated = await updateGlobalSet(globalSet.handle, {
        name: state.name.trim(),
        fields: fieldsForSaving(state.fields),
      });
      // Every language's form uses the new fields from now on.
      void queryClient.invalidateQueries({ queryKey: globalKeys.globalSets() });
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
      await deleteGlobalSet(globalSet.handle);
      await queryClient.invalidateQueries({ queryKey: globalKeys.globalSets() });
      await navigate({ to: "/content/globals", ignoreBlocker: true });
    } catch (error) {
      setSaveError(describeError(error));
      setIsDeleting(false);
    }
  }

  return (
    <>
      <BackLink to="/content/globals/$handle" params={{ handle: globalSet.handle }}>
        {globalSet.name}
      </BackLink>
      <ManagedInCodeBanner />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-large-title text-label">
            {t("globals.fieldsTitle", { name: state.name.trim() || globalSet.name })}
          </h1>
          <p className="mt-1 text-body text-label-secondary">
            {tCount(
              { one: "builder.fieldCount.one", other: "builder.fieldCount.other" },
              state.fields.length,
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Button variant="destructive" onClick={() => setIsDeleting(true)}>
            {t("globals.delete")}
          </Button>
          <Button onClick={() => void save()} disabled={isSaving || !isUnsaved}>
            {isSaving ? t("builder.saving") : t("builder.save")}
          </Button>
        </div>
      </div>

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
            label={t("globals.name")}
            hint={t("globals.nameHint")}
            value={state.name}
            error={problems.name}
            onChange={(event) => dispatch({ type: "renamed", name: event.target.value })}
            className="max-w-md"
          />
        </section>

        <FieldsBuilder
          fields={state.fields}
          problems={problems}
          canEdit
          dispatch={dispatch}
          removeMessage={t("globals.removeFieldMessage")}
          canShowInList={false}
        />
      </div>

      <ConfirmDialog
        open={isDeleting}
        title={t("globals.deleteTitle", { name: globalSet.name })}
        message={t("globals.deleteMessage")}
        confirmLabel={t("globals.delete")}
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
