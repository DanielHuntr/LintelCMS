import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Inbox, Plus } from "lucide-react";
import { useState } from "react";
import { ApiError, apiUrl } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { isSameValue } from "../content/sameValue.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { CopyButton } from "../design/CopyButton.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddFormFieldSheet } from "./AddFormFieldSheet.js";
import {
  addField,
  cleanChoices,
  findFieldProblems,
  moveFieldBy,
  moveFieldTo,
  newField,
  relabelField,
  removeField,
  updateField,
} from "./formDraft.js";
import { newFieldLabels } from "./formFieldTypes.js";
import { FormFieldList } from "./FormFieldList.js";
import { FormFieldSettingsSheet } from "./FormFieldSettingsSheet.js";
import { FormPreview } from "./FormPreview.js";
import { useDeleteForm, useForm, useUpdateForm } from "./forms.queries.js";
import type { Form, FormField, FormFieldType } from "./forms.types.js";
import { FormSettingsSection, type FormSettingsDraft } from "./FormSettingsSection.js";

type Tab = "fields" | "settings" | "share";

/** What the builder edits, and saves in one go with the Save button. */
interface FormDraft extends FormSettingsDraft {
  name: string;
  fields: FormField[];
}

function draftOf(form: Form): FormDraft {
  return {
    name: form.name,
    fields: form.fields,
    submitLabel: form.submitLabel,
    confirmation: form.confirmation,
    notifications: form.notifications,
    retentionDays: form.retentionDays,
    acceptingSubmissions: form.acceptingSubmissions,
  };
}

/** /forms/$formId: build the form, with a live preview, and choose what happens after. */
export function FormBuilderPage({ formId }: { formId: string }) {
  const form = useForm(formId);

  if (form.isError) {
    return (
      <>
        <BackLink to="/forms">{t("nav.forms")}</BackLink>
        <LoadError error={form.error} onRetry={() => void form.refetch()} />
      </>
    );
  }
  if (!form.data) {
    return (
      <LoadingRegion label={t("forms.builder.loading")}>
        <Skeleton className="mb-6 h-10 w-64 rounded-control" />
        <Skeleton className="h-64 max-w-3xl rounded-card" />
      </LoadingRegion>
    );
  }
  return <FormBuilder key={form.data.id} form={form.data} />;
}

function FormBuilder({ form }: { form: Form }) {
  const canEdit = useCan("forms:update");
  const canDelete = useCan("forms:delete");
  const updateForm = useUpdateForm(form.id);
  const deleteForm = useDeleteForm();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => draftOf(form));
  const [draft, setDraft] = useState(() => draftOf(form));
  const [tab, setTab] = useState<Tab>("fields");
  const [isAdding, setIsAdding] = useState(false);
  const [openFieldId, setOpenFieldId] = useState<string | null>(null);
  const [hasTriedToSave, setHasTriedToSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isUnsaved = !isSameValue(saved, draft);
  const leaveWarning = useLeaveWarning(isUnsaved && !deleteForm.isSuccess);
  const problems = hasTriedToSave ? findFieldProblems(draft.fields) : {};
  const openField = draft.fields.find((field) => field.id === openFieldId);
  const setFields = (fields: FormField[]) => setDraft((current) => ({ ...current, fields }));

  async function save() {
    setHasTriedToSave(true);
    setSaveError(null);
    if (Object.keys(findFieldProblems(draft.fields)).length > 0 || draft.name.trim() === "") {
      setTab("fields");
      setSaveError(t("forms.builder.fixProblems"));
      return;
    }
    const fields = draft.fields.map((field) =>
      field.options.choices
        ? { ...field, options: { ...field.options, choices: cleanChoices(field.options.choices) } }
        : field,
    );
    try {
      const updated = await updateForm.mutateAsync({ ...draft, name: draft.name.trim(), fields });
      setSaved(draftOf(updated));
      setDraft(draftOf(updated));
      setHasTriedToSave(false);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : describeError(error));
    }
  }

  function pickType(type: FormFieldType) {
    const field = newField(type, t(newFieldLabels[type]), draft.fields);
    setFields(addField(draft.fields, field));
    setIsAdding(false);
    setOpenFieldId(field.id);
  }

  const embedCode = `<script src="${apiUrl}/delivery/forms.js" data-form="${form.handle}" async></script>`;
  const submissionsLabel =
    form.unreadCount > 0
      ? t("forms.builder.submissionsUnread", { count: form.unreadCount })
      : t("forms.builder.submissions");

  return (
    <>
      <BackLink to="/forms">{t("nav.forms")}</BackLink>
      <LargeTitle
        title={draft.name.trim() || form.name}
        subtitle={isUnsaved ? t("forms.builder.unsaved") : t("forms.builder.subtitle")}
        actions={
          <>
            <LinkButton
              variant="tinted"
              icon={<Inbox aria-hidden="true" />}
              to="/forms/$formId/submissions"
              params={{ formId: form.id }}
            >
              {submissionsLabel}
            </LinkButton>
            {canEdit && (
              <Button onClick={() => void save()} disabled={updateForm.isPending || !isUnsaved}>
                {updateForm.isPending ? t("forms.builder.saving") : t("forms.builder.save")}
              </Button>
            )}
          </>
        }
      />

      {saveError && (
        <p
          role="alert"
          className="mb-6 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          {saveError}
        </p>
      )}

      <div className="mb-6 max-w-md">
        <SegmentedControl<Tab>
          label={t("forms.builder.tabs")}
          options={[
            { value: "fields", label: t("forms.builder.tabFields") },
            { value: "settings", label: t("forms.builder.tabSettings") },
            { value: "share", label: t("forms.builder.tabShare") },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "fields" && (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <section aria-labelledby="form-fields-heading" className="flex flex-col gap-3">
            <div className="rounded-card bg-surface p-5">
              <TextField
                label={t("forms.builder.name")}
                value={draft.name}
                error={
                  hasTriedToSave && draft.name.trim() === ""
                    ? t("forms.builder.nameMissing")
                    : undefined
                }
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="max-w-md"
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-end justify-between px-1">
              <h2 id="form-fields-heading" className="text-headline text-label">
                {t("forms.builder.fieldsHeading")}
              </h2>
              {canEdit && draft.fields.length > 0 && (
                <Button
                  variant="tinted"
                  size="small"
                  icon={<Plus aria-hidden="true" />}
                  onClick={() => setIsAdding(true)}
                >
                  {t("forms.builder.addField")}
                </Button>
              )}
            </div>
            {draft.fields.length === 0 ? (
              <div className="rounded-card bg-surface">
                <EmptyState
                  icon={Plus}
                  title={t("forms.builder.emptyTitle")}
                  description={t("forms.builder.emptyDescription")}
                  action={
                    canEdit && (
                      <Button icon={<Plus aria-hidden="true" />} onClick={() => setIsAdding(true)}>
                        {t("forms.builder.addField")}
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <FormFieldList
                fields={draft.fields}
                problems={problems}
                onMoveBy={(fieldId, direction) =>
                  setFields(moveFieldBy(draft.fields, fieldId, direction))
                }
                onMoveTo={(fieldId, targetId) =>
                  setFields(moveFieldTo(draft.fields, fieldId, targetId))
                }
                onOpen={setOpenFieldId}
              />
            )}
            <p className="px-1 text-footnote text-label-secondary">
              {t("forms.builder.reorderHint")}
            </p>
          </section>
          <div className="lg:sticky lg:top-6">
            <FormPreview name={draft.name} fields={draft.fields} submitLabel={draft.submitLabel} />
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="flex flex-col gap-8">
          <FormSettingsSection
            draft={draft}
            hasEmailField={draft.fields.some((field) => field.type === "email")}
            onChange={(changes) => setDraft({ ...draft, ...changes })}
          />
          {canDelete && (
            <section className="max-w-2xl rounded-card bg-surface p-4">
              <h2 className="text-headline text-label">{t("forms.builder.deleteTitle")}</h2>
              <p className="mt-1 mb-3 text-footnote text-label-secondary">
                {t("forms.builder.deleteHint")}
              </p>
              <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)}>
                {t("forms.builder.delete")}
              </Button>
            </section>
          )}
        </div>
      )}

      {tab === "share" && (
        <div className="flex max-w-2xl flex-col gap-6">
          <section className="rounded-card bg-surface p-5">
            <h2 className="text-headline text-label">{t("forms.share.pageTitle")}</h2>
            <p className="mt-1 text-body text-label-secondary">
              {t("forms.share.pageDescription")}
            </p>
          </section>
          {/* Code and the API are for whoever built the site: folded away until asked for. */}
          <details className="group rounded-card bg-surface p-5">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-headline text-label focus-visible:focus-ring">
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-label-secondary transition-transform group-open:rotate-90 motion-reduce:transition-none"
              />
              {t("forms.share.developersTitle")}
            </summary>
            <h3 className="mt-4 text-body font-semibold text-label">
              {t("forms.share.embedTitle")}
            </h3>
            <p className="mt-1 mb-3 text-body text-label-secondary">
              {t("forms.share.embedDescription")}
            </p>
            <pre className="overflow-x-auto rounded-control bg-fill p-3 text-footnote text-label">
              <code>{embedCode}</code>
            </pre>
            <div className="mt-3">
              <CopyButton value={embedCode} label={t("forms.share.copyEmbed")} />
            </div>
            <p className="mt-3 text-footnote text-label-secondary">
              {t("forms.share.embedFooter")}
            </p>
            <h3 className="mt-5 text-body font-semibold text-label">{t("forms.share.apiTitle")}</h3>
            <p className="mt-1 text-body text-label-secondary">
              {t("forms.share.apiDescription", { handle: form.handle })}
            </p>
            <p className="mt-2 font-mono text-footnote text-label">{`${apiUrl}/delivery/forms/${form.handle}`}</p>
          </details>
        </div>
      )}

      <AddFormFieldSheet open={isAdding} onPick={pickType} onClose={() => setIsAdding(false)} />
      {openField && (
        <FormFieldSettingsSheet
          key={openField.id}
          field={openField}
          problem={problems[openField.id]}
          onChange={(changes) => setFields(updateField(draft.fields, openField.id, changes))}
          onRelabel={(label, follows) =>
            setFields(relabelField(draft.fields, openField.id, label, follows))
          }
          onRemove={() => {
            setFields(removeField(draft.fields, openField.id));
            setOpenFieldId(null);
          }}
          onClose={() => setOpenFieldId(null)}
        />
      )}
      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("forms.builder.deleteConfirmTitle", { name: form.name })}
        message={t("forms.builder.deleteConfirmMessage", { count: form.submissionCount })}
        confirmLabel={t("forms.builder.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={deleteForm.isPending}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() =>
          deleteForm.mutate(form.id, { onSuccess: () => void navigate({ to: "/forms" }) })
        }
      />
      <ConfirmDialog
        open={leaveWarning.isAsking}
        title={t("forms.builder.leaveTitle")}
        message={t("forms.builder.leaveMessage")}
        confirmLabel={t("forms.builder.leave")}
        cancelLabel={t("forms.builder.stay")}
        isDestructive
        onConfirm={leaveWarning.leave}
        onCancel={leaveWarning.stay}
      />
    </>
  );
}
