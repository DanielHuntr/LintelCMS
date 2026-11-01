import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useReducer, useRef, useState } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import type { Blueprint } from "../content-types/blueprints.types.js";
import { titleFieldHandle } from "../fields/field.types.js";
import { textValue } from "../fields/fieldValues.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { Collection, Entry } from "./content.types.js";
import { entryDraftReducer, hasUnsavedChanges, initialDraftState } from "./entryDraft.js";
import { EntryEditorBar } from "./EntryEditorBar.js";
import { EntryFields } from "./EntryFields.js";
import { EntrySidePanel } from "./EntrySidePanel.js";
import { EntrySlugInput } from "./EntrySlugInput.js";
import { EntryTitleInput } from "./EntryTitleInput.js";
import {
  errorsWithoutAField,
  fieldErrorsFrom,
  firstFieldWithError,
  focusField,
} from "./fieldErrors.js";
import { SaveIndicator } from "./SaveIndicator.js";
import { useAutosave } from "./useAutosave.js";
import { useEntryActions } from "./useEntryActions.js";
import { useLeaveWarning } from "./useLeaveWarning.js";

interface EntryEditorProps {
  collection: Collection;
  blueprint: Blueprint;
  /** Undefined for a new entry. */
  initialEntry: Entry | undefined;
  onCreated: (entry: Entry) => void;
}

/**
 * The entry editor: a calm document with the title at the top and the blueprint's fields
 * below, autosaving as a draft, with publishing and history in a side panel.
 */
export function EntryEditor({ collection, blueprint, initialEntry, onCreated }: EntryEditorProps) {
  const [state, dispatch] = useReducer(entryDraftReducer, initialEntry, initialDraftState);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const documentElement = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const navigate = useNavigate();

  const actions = useEntryActions({
    collectionHandle: collection.handle,
    initialEntry,
    dispatch,
    onCreated,
  });
  const { entry } = actions;
  const canPublish = useCan("entries:publish");
  const canDelete = useCan("entries:delete");
  const canSave = useCan(entry ? "entries:update" : "entries:create");

  const isUnsaved = hasUnsavedChanges(state);
  const title = textValue(state.current.data[titleFieldHandle]);
  const titleField = blueprint.fields.find((field) => field.handle === titleFieldHandle);
  const handlesInOrder = [
    titleFieldHandle,
    "slug",
    ...blueprint.fields.map((field) => field.handle),
  ];

  const { saveNow } = useAutosave({
    draft: state.current,
    hasUnsavedChanges: isUnsaved,
    // A new entry isn't created until it has a title, so empty drafts don't pile up.
    isEnabled: canSave && (entry !== undefined || title.trim() !== ""),
    save: actions.save,
  });
  const leaveWarning = useLeaveWarning(isUnsaved);

  function focusFirstFieldError(error: unknown) {
    const handle = firstFieldWithError(handlesInOrder, fieldErrorsFrom(error));
    if (handle && documentElement.current) focusField(documentElement.current, handle);
  }

  /** Saves now (a new entry is created even if untouched), moving focus to any problem. */
  async function saveExplicitly(): Promise<boolean> {
    try {
      await saveNow({ force: entry === undefined });
      return true;
    } catch (error) {
      focusFirstFieldError(error);
      return false;
    }
  }

  async function publish() {
    if (await saveExplicitly()) await actions.publish();
  }

  async function deleteEntry() {
    if (!(await actions.remove())) return;
    setIsConfirmingDelete(false);
    await navigate({
      to: "/content/$collection",
      params: { collection: collection.handle },
      ignoreBlocker: true,
    });
  }

  const saveWithShortcut = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveExplicitly();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", saveWithShortcut);
    return () => window.removeEventListener("keydown", saveWithShortcut);
  }, []);

  const unplacedErrors = errorsWithoutAField(handlesInOrder, state.fieldErrors);
  const bannerMessage = actions.actionError ?? unplacedErrors[0] ?? null;

  return (
    <>
      <h1 className="sr-only">{title || t("editor.untitled")}</h1>

      <EntryEditorBar
        collectionHandle={collection.handle}
        collectionName={collection.name}
        isPanelOpen={isPanelOpen}
        panelId={panelId}
        onTogglePanel={() => setIsPanelOpen((wasOpen) => !wasOpen)}
        onDelete={entry && canDelete ? () => setIsConfirmingDelete(true) : undefined}
        saveIndicator={
          <SaveIndicator
            status={state.saveStatus}
            hasUnsavedChanges={isUnsaved}
            errorMessage={state.saveError}
            onRetry={() => void saveExplicitly()}
          />
        }
        primaryAction={
          canPublish ? (
            <PublishButton
              entry={entry}
              hasUnsavedChanges={isUnsaved}
              disabled={actions.isWorking}
              onPublish={publish}
            />
          ) : (
            <Button
              onClick={() => void saveExplicitly()}
              disabled={!isUnsaved && entry !== undefined}
            >
              {t("editor.save")}
            </Button>
          )
        }
      />

      {bannerMessage && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          <CircleAlert
            aria-hidden="true"
            strokeWidth={2}
            className="mt-px size-4 shrink-0 text-danger"
          />
          <p className="flex-1">{bannerMessage}</p>
          {actions.actionError && (
            <button
              type="button"
              onClick={actions.dismissActionError}
              aria-label={t("common.dismiss")}
              className="-m-1 flex size-6 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
            >
              <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <div
        className={classNames(
          "grid items-start gap-8",
          isPanelOpen ? "grid-cols-[minmax(0,1fr)_17rem]" : "grid-cols-1",
        )}
      >
        <div
          ref={documentElement}
          // The document sits on a white page over the grey desk, like a document in Pages.
          className={classNames(
            "flex min-w-0 flex-col gap-9 rounded-panel bg-surface px-9 pt-8 pb-10",
            !isPanelOpen && "mx-auto w-full max-w-[46rem]",
          )}
        >
          <div className="flex flex-col gap-1">
            <EntryTitleInput
              label={titleField?.label ?? t("editor.titleFallback")}
              value={title}
              onChange={(value) =>
                dispatch({ type: "fieldChanged", handle: titleFieldHandle, value })
              }
              error={state.fieldErrors[titleFieldHandle]}
            />
            <EntrySlugInput
              routePattern={collection.routePattern}
              slug={state.current.slug}
              onChange={(slug) => dispatch({ type: "slugChanged", slug })}
              error={state.fieldErrors.slug}
            />
          </div>

          <EntryFields
            key={state.formVersion}
            fields={blueprint.fields}
            data={state.current.data}
            errors={state.fieldErrors}
            onChange={(handle, value) => dispatch({ type: "fieldChanged", handle, value })}
          />
        </div>

        {isPanelOpen && (
          <EntrySidePanel
            id={panelId}
            collection={collection}
            entry={entry}
            parentId={state.current.parentId}
            onParentChange={(parentId) => dispatch({ type: "parentChanged", parentId })}
            canPublish={canPublish}
            isWorking={actions.isWorking}
            onUnpublish={() => void actions.unpublish()}
            onSchedule={(publishAt) =>
              void saveExplicitly().then((saved) => saved && actions.schedule(publishAt))
            }
            onRestore={async (revisionId) => {
              await actions.restore(revisionId);
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("editor.deleteTitle", { title: title || t("editor.untitled") })}
        message={t("editor.deleteMessage")}
        confirmLabel={t("editor.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={actions.isWorking}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => void deleteEntry()}
      />

      <ConfirmDialog
        open={leaveWarning.isAsking}
        title={t("editor.leaveTitle")}
        message={t("editor.leaveMessage")}
        confirmLabel={t("editor.leave")}
        cancelLabel={t("editor.stay")}
        isDestructive
        onCancel={leaveWarning.stay}
        onConfirm={leaveWarning.leave}
      />
    </>
  );
}

interface PublishButtonProps {
  entry: Entry | undefined;
  hasUnsavedChanges: boolean;
  disabled: boolean;
  onPublish: () => void;
}

/** "Publish", or "Publish changes" for a live entry with newer edits, or a quiet "Published". */
function PublishButton({ entry, hasUnsavedChanges, disabled, onPublish }: PublishButtonProps) {
  const isLive = entry?.status === "published";
  const hasNewerEdits = hasUnsavedChanges || entry?.hasUnpublishedChanges === true;

  if (isLive && !hasNewerEdits) {
    return (
      <Button variant="tinted" disabled>
        {t("editor.published")}
      </Button>
    );
  }

  return (
    <Button onClick={onPublish} disabled={disabled}>
      {isLive ? t("editor.publishChanges") : t("editor.publish")}
    </Button>
  );
}
