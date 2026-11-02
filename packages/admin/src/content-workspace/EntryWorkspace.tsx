import { CircleAlert, X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useReducer, useRef, useState } from "react";
import type { Collection, Entry } from "../content/content.types.js";
import { entryDraftReducer, hasUnsavedChanges, initialDraftState } from "../content/entryDraft.js";
import { EntryFields } from "../content/EntryFields.js";
import {
  errorsWithoutAField,
  fieldErrorsFrom,
  firstFieldWithError,
  focusField,
  focusTargetFor,
} from "../content/fieldErrors.js";
import { RevisionHistory } from "../content/RevisionHistory.js";
import { TranslationsSection } from "../content/TranslationsSection.js";
import { useAutosave } from "../content/useAutosave.js";
import { useEntryActions } from "../content/useEntryActions.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { viewPageTarget } from "../content/viewPage.js";
import { describeError } from "../api/describeError.js";
import { runBulkAction } from "../content-tree/contentTree.api.js";
import { useEntryInfo, useRefreshContent } from "../content-tree/contentTree.queries.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { classNames } from "../design/classNames.js";
import { titleFieldHandle } from "../fields/field.types.js";
import { textValue } from "../fields/fieldValues.js";
import { t } from "../i18n/strings.js";
import { PageMenuSection } from "../menus/PageMenuSection.js";
import { PluginEditorPanels } from "../plugins/PluginEditorPanels.js";
import { EntryPreviewPane } from "../preview/EntryPreviewPane.js";
import { useCan } from "../session/SessionContext.js";
import { useViewPageSite } from "../website/website.queries.js";
import { CollectionView } from "./CollectionView.js";
import { InfoTab } from "./InfoTab.js";
import { PublishWithParentDialog } from "./PublishWithParentDialog.js";
import { WorkspaceFooter } from "./WorkspaceFooter.js";
import { WorkspaceHeader } from "./WorkspaceHeader.js";
import { WorkspaceTabList } from "./WorkspaceTabList.js";
import { type WorkspaceTab, visibleWorkspaceTabs } from "./workspaceTabs.js";

interface EntryWorkspaceProps {
  collection: Collection;
  initialEntry: Entry;
  tab: WorkspaceTab | undefined;
  isPreviewOpen: boolean;
  onTabChange: (tab: WorkspaceTab) => void;
  onPreviewChange: (isOpen: boolean) => void;
}

/**
 * An entry's workspace, beside the content tree: a header with its name (edited in place),
 * breadcrumbs and status; tabs for its fields, its children (when they're listed here),
 * settings, history and info; and a bar along the bottom to save and publish. It saves as
 * people type, like the editor it grew from, and asks before leaving unsaved changes.
 */
export function EntryWorkspace({
  collection,
  initialEntry,
  tab,
  isPreviewOpen,
  onTabChange,
  onPreviewChange,
}: EntryWorkspaceProps) {
  const [state, dispatch] = useReducer(entryDraftReducer, initialEntry, initialDraftState);
  const documentElement = useRef<HTMLDivElement>(null);
  const previewId = useId();
  const panelIds = useId();
  const refresh = useRefreshContent();
  const info = useEntryInfo(initialEntry.id);

  const actions = useEntryActions({
    collectionHandle: collection.handle,
    initialEntry,
    dispatch,
    saved: state.saved,
    onCreated: () => undefined,
    onPublishBlocked: (error) => focusFirstFieldError(error),
  });
  const entry = actions.entry ?? initialEntry;
  const canPublish = useCan("entries:publish");
  const canSave = useCan("entries:update");
  const site = useViewPageSite();
  const viewPage = viewPageTarget(site, collection, entry, info.data?.url);

  const isUnsaved = hasUnsavedChanges(state);
  const title = textValue(state.current.data[titleFieldHandle]);
  const blueprint = entry.blueprint;
  const handlesInOrder = [
    titleFieldHandle,
    "slug",
    ...blueprint.fields.map((field) => field.handle),
  ];
  // Any page with pages under it can show them as a list ("Show as list" in the tree).
  const listsChildren = (info.data?.childCount ?? 0) > 0;
  const childrenInTree = !(info.data?.childrenAsCollection ?? false);
  const tabs = visibleWorkspaceTabs({ listsChildren });
  const selectedTab = tab && tabs.includes(tab) ? tab : "content";

  const { saveNow } = useAutosave({
    draft: state.current,
    hasUnsavedChanges: isUnsaved,
    isEnabled: canSave,
    save: async (draft, options) => {
      const saved = await actions.save(draft, options);
      // The tree shows the name and the "changed since publishing" dot.
      void refresh();
      return saved;
    },
  });
  const leaveWarning = useLeaveWarning(isUnsaved);

  function focusFirstFieldError(error: unknown) {
    const errors = fieldErrorsFrom(error);
    const handle = firstFieldWithError(handlesInOrder, errors);
    if (!handle) return;
    if (selectedTab !== "content") onTabChange("content");
    requestAnimationFrame(() => {
      if (documentElement.current)
        focusField(documentElement.current, focusTargetFor(handle, errors));
    });
  }

  async function saveExplicitly({ saveVersion = false } = {}): Promise<boolean> {
    try {
      await saveNow({ force: saveVersion, saveVersion });
      return true;
    } catch (error) {
      focusFirstFieldError(error);
      return false;
    }
  }

  async function afterPublishing(succeeded: boolean) {
    if (succeeded) await refresh([entry.id]);
  }

  // A page going live under a parent that isn't live is asked about first (LINTEL-SPEC-001).
  const [parentQuestion, setParentQuestion] = useState<{
    isWorking: boolean;
    error: string | null;
  } | null>(null);
  const unpublishedAncestors = info.data?.unpublishedAncestors ?? [];

  async function saveAndPublish() {
    if (await saveExplicitly()) await afterPublishing(await actions.publish());
  }

  async function publishWithParent() {
    setParentQuestion({ isWorking: true, error: null });
    try {
      const result = await runBulkAction(
        "publish",
        unpublishedAncestors.map((ancestor) => ancestor.id),
      );
      const [skipped] = result.skipped;
      if (skipped) {
        const message = t("workspace.parentUnpublished.failed", {
          title: skipped.title || t("editor.untitled"),
          reason: skipped.reason,
        });
        setParentQuestion({ isWorking: false, error: message });
        await refresh(result.changed);
        return;
      }
      await refresh(result.changed);
    } catch (failure) {
      setParentQuestion({ isWorking: false, error: describeError(failure) });
      return;
    }
    setParentQuestion(null);
    await saveAndPublish();
  }

  const saveWithShortcut = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveExplicitly({ saveVersion: true });
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", saveWithShortcut);
    return () => window.removeEventListener("keydown", saveWithShortcut);
  }, []);

  const unplacedErrors = errorsWithoutAField(handlesInOrder, state.fieldErrors);
  const bannerMessage = actions.actionError ?? unplacedErrors[0] ?? null;
  const showsPreview = isPreviewOpen && selectedTab === "content";

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <WorkspaceHeader
        collection={collection}
        entry={entry}
        title={title}
        slug={state.current.slug}
        titleLabel={blueprint.fields.find((field) => field.handle === titleFieldHandle)?.label}
        fieldErrors={state.fieldErrors}
        viewPage={viewPage}
        info={info.data}
        onTitleChange={(value) =>
          dispatch({ type: "fieldChanged", handle: titleFieldHandle, value })
        }
        onSlugChange={(slug) => dispatch({ type: "slugChanged", slug })}
      />

      {bannerMessage && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
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

      <WorkspaceTabList
        idPrefix={panelIds}
        title={title || t("editor.untitled")}
        tabs={tabs}
        selected={selectedTab}
        onSelect={onTabChange}
      />

      <div
        role="tabpanel"
        id={`${panelIds}-panel`}
        aria-labelledby={`${panelIds}-${selectedTab}`}
        className="flex-1 pt-5 pb-6"
      >
        {selectedTab === "content" && (
          <div
            className={classNames(
              "grid items-start gap-5",
              showsPreview && "@min-[64rem]:grid-cols-2",
            )}
          >
            <div ref={documentElement} className="min-w-0 rounded-panel bg-surface px-9 pt-8 pb-10">
              <EntryFields
                key={state.formVersion}
                fields={blueprint.fields.filter((field) => field.handle !== titleFieldHandle)}
                data={state.current.data}
                errors={state.fieldErrors}
                onChange={(handle, value) => dispatch({ type: "fieldChanged", handle, value })}
              />
            </div>
            {showsPreview && (
              <EntryPreviewPane
                id={previewId}
                collection={collection}
                entry={entry}
                fields={blueprint.fields}
                title={title}
                onClose={() => onPreviewChange(false)}
              />
            )}
          </div>
        )}
        {selectedTab === "children" && (
          <CollectionView
            place={{ parentId: entry.id }}
            placeName={title || t("editor.untitled")}
            allLevels={childrenInTree}
          />
        )}
        {selectedTab === "settings" && (
          <div className="flex max-w-xl flex-col overflow-hidden rounded-card bg-surface">
            {collection.structure === "tree" && Boolean(collection.routePattern) && (
              <PageMenuSection entryId={entry.id} pageTitle={title || t("editor.untitled")} />
            )}
            <TranslationsSection
              collectionHandle={collection.handle}
              entry={entry}
              locale={entry.locale}
            />
            <PluginEditorPanels
              entryId={entry.id}
              entryTitle={title}
              slug={state.current.slug}
              collection={{
                handle: collection.handle,
                name: collection.name,
                routePattern: collection.routePattern,
              }}
            />
          </div>
        )}
        {selectedTab === "history" && (
          <div className="max-w-xl overflow-hidden rounded-card bg-surface">
            <RevisionHistory
              entryId={entry.id}
              isWorking={actions.isWorking}
              onRestore={async (revisionId) => {
                await actions.restore(revisionId);
                await refresh([entry.id]);
              }}
            />
          </div>
        )}
        {selectedTab === "info" && <InfoTab entry={entry} collection={collection} info={info} />}
      </div>

      <WorkspaceFooter
        entry={entry}
        title={title}
        saveStatus={state.saveStatus}
        saveError={state.saveError}
        hasUnsavedChanges={isUnsaved}
        canSave={canSave}
        canPublish={canPublish}
        isWorking={actions.isWorking}
        viewPage={viewPage}
        isPreviewOpen={showsPreview}
        previewId={previewId}
        onTogglePreview={() => {
          if (selectedTab !== "content") onTabChange("content");
          onPreviewChange(!showsPreview);
        }}
        onSave={() => void saveExplicitly({ saveVersion: true })}
        onSaveAndPublish={async () => {
          if (entry.status !== "published" && unpublishedAncestors.length > 0) {
            setParentQuestion({ isWorking: false, error: null });
            return;
          }
          await saveAndPublish();
        }}
        onSchedule={async (publishAt) => {
          if (await saveExplicitly()) await afterPublishing(await actions.schedule(publishAt));
        }}
        onUnpublish={async () => afterPublishing(await actions.unpublish())}
      />

      <PublishWithParentDialog
        open={parentQuestion !== null}
        title={title || t("editor.untitled")}
        ancestors={unpublishedAncestors}
        isWorking={parentQuestion?.isWorking ?? false}
        error={parentQuestion?.error ?? null}
        onCancel={() => setParentQuestion(null)}
        onPublishAlone={() => {
          setParentQuestion(null);
          void saveAndPublish();
        }}
        onPublishWithParent={() => void publishWithParent()}
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
    </div>
  );
}
