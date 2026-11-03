import { Plus } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { describeError } from "../api/describeError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { Processor } from "./privacy.api.js";
import { useProcessors, useSaveProcessors } from "./privacy.queries.js";

type Draft = Omit<Processor, "origin">;

const emptyDraft = (): Draft => ({
  id: crypto.randomUUID(),
  name: "",
  purpose: "",
  location: "",
  link: "",
});

/**
 * Settings → Privacy → Companies you share data with: those found on the site, then those
 * the owner adds (their host first), for the record a site owner is expected to keep.
 */
export function ProcessorsPage() {
  const processors = useProcessors();
  const save = useSaveProcessors();
  const [editing, setEditing] = useState<Draft | null>(null);
  const added = processors.data?.added ?? [];

  const strip = (list: Processor[]): Draft[] => list.map(({ origin: _origin, ...rest }) => rest);

  function saveDraft(draft: Draft) {
    const others = strip(added).filter((processor) => processor.id !== draft.id);
    const exists = added.some((processor) => processor.id === draft.id);
    const next = exists
      ? strip(added).map((processor) => (processor.id === draft.id ? draft : processor))
      : [...others, draft];
    save.mutate(next, { onSuccess: () => setEditing(null) });
  }

  function remove(id: string) {
    save.mutate(
      strip(added).filter((processor) => processor.id !== id),
      { onSuccess: () => setEditing(null) },
    );
  }

  return (
    <Page width="readable">
      <BackLink to="/settings/privacy">{t("privacy.title")}</BackLink>
      <LargeTitle
        title={t("privacy.processors.title")}
        subtitle={t("privacy.processors.subtitle")}
        actions={
          <Button icon={<Plus aria-hidden="true" />} onClick={() => setEditing(emptyDraft())}>
            {t("privacy.processors.add")}
          </Button>
        }
      />
      {processors.isError && (
        <LoadError error={processors.error} onRetry={() => void processors.refetch()} />
      )}
      {processors.isPending && (
        <LoadingRegion label={t("privacy.processors.loading")}>
          <Skeleton className="h-48 rounded-card" />
        </LoadingRegion>
      )}
      {processors.data && (
        <div className="flex flex-col gap-8">
          <GroupedList header={t("privacy.processors.foundHeader")}>
            {processors.data.detected.length === 0 ? (
              <GroupedListRow label={t("privacy.processors.foundEmpty")} wrapsText />
            ) : (
              processors.data.detected.map((processor) => (
                <GroupedListRow
                  key={processor.id}
                  label={processor.name}
                  description={processor.purpose}
                  wrapsText
                />
              ))
            )}
          </GroupedList>
          <GroupedList
            header={t("privacy.processors.addedHeader")}
            footer={t("privacy.processors.addedFooter")}
          >
            {added.length === 0 ? (
              <GroupedListRow label={t("privacy.processors.addedEmpty")} wrapsText />
            ) : (
              added.map((processor) => (
                <GroupedListRow
                  key={processor.id}
                  label={processor.name}
                  description={[processor.purpose, processor.location].filter(Boolean).join(" · ")}
                  wrapsText
                  onSelect={() => setEditing(strip([processor])[0] ?? null)}
                />
              ))
            )}
          </GroupedList>
        </div>
      )}
      {editing && (
        <ProcessorDialog
          draft={editing}
          isNew={!added.some((processor) => processor.id === editing.id)}
          isSaving={save.isPending}
          error={save.isError ? describeError(save.error) : null}
          onSave={saveDraft}
          onRemove={() => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

function ProcessorDialog({
  draft,
  isNew,
  isSaving,
  error,
  onSave,
  onRemove,
  onClose,
}: {
  draft: Draft;
  isNew: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (draft: Draft) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState(draft);
  const set = (key: keyof Draft) => (event: { target: { value: string } }) =>
    setValues({ ...values, [key]: event.target.value });
  const formId = `processor-${draft.id}`;

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t("privacy.processors.dialogTitle") : values.name || draft.name}
      footer={
        <>
          {!isNew && (
            <Button variant="destructive" onClick={onRemove} disabled={isSaving}>
              {t("privacy.processors.remove")}
            </Button>
          )}
          <Button variant="tinted" onClick={onClose} disabled={isSaving}>
            {t("privacy.processors.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={isSaving || values.name.trim() === ""}>
            {t("privacy.processors.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(values);
        }}
      >
        <TextField
          label={t("privacy.processors.name")}
          value={values.name}
          onChange={set("name")}
          data-autofocus
          required
        />
        <TextField
          label={t("privacy.processors.purpose")}
          value={values.purpose}
          onChange={set("purpose")}
        />
        <TextField
          label={t("privacy.processors.location")}
          value={values.location}
          onChange={set("location")}
        />
        <TextField
          type="url"
          label={t("privacy.processors.link")}
          value={values.link}
          onChange={set("link")}
        />
        {error && (
          <p role="alert" className="text-footnote text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
