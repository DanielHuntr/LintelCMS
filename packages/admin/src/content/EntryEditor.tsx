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
import { DesignFirstFields } from "../page-design/DesignFirstFields.js";
import { EntryPreviewPane } from "../preview/EntryPreviewPane.js";
import { PluginEditorPanels } from "../plugins/PluginEditorPanels.js";
import { useCan } from "../session/SessionContext.js";
import { CopyToSiteDialog } from "../sites/CopyToSiteDialog.js";
import { useCurrentSite } from "../sites/SiteContext.js";
import type { Collection, Entry } from "./content.types.js";
import { entryDraftReducer, hasUnsavedChanges, initialDraftState } from "./entryDraft.js";
import { type Companion, editorColumns, editorWidths } from "./editorLayout.js";
import { EntryEditorBar } from "./EntryEditorBar.js";
import { EntryFields } from "./EntryFields.js";
import { defaultValues } from "../fields/fieldLayout.js";
import { EntrySidePanel } from "./EntrySidePanel.js";
import { EntrySlugInput } from "./EntrySlugInput.js";
import { EntryTitleInput } from "./EntryTitleInput.js";
import type { FieldMessages } from "../api/client.js";
import {
  countFieldsWithErrors,
  errorsWithoutAField,
  fieldErrorsFrom,
  firstFieldWithError,
  focusField,
  focusTargetFor,
} from "./fieldErrors.js";
import { SaveIndicator } from "./SaveIndicator.js";
import { useAutosave } from "./useAutosave.js";
import { useEntryActions } from "./useEntryActions.js";
import { viewPageTarget } from "./viewPage.js";
import { useViewPageSite } from "../website/website.queries.js";
import { useLeaveWarning } from "./useLeaveWarning.js";
import { describeError } from "../api/describeError.js";
import { runBulkAction } from "../content-tree/contentTree.api.js";
import { useEntryInfo, useRefreshContent } from "../content-tree/contentTree.queries.js";
import { CollectionView } from "../content-workspace/CollectionView.js";
import { entryAddressPattern } from "../content-workspace/entryAddressPattern.js";
import { InfoTab } from "../content-workspace/InfoTab.js";
import { PageStatus } from "../content-workspace/PageStatus.js";
import { PublishWithParentDialog } from "../content-workspace/PublishWithParentDialog.js";
import type { WorkspaceTab } from "../content-workspace/workspaceTabs.js";
import { Dialog } from "../design/Dialog.js";
import { useToast } from "../design/Toast.js";
import { useRecycleWithUndo } from "../content-tree/useRecycleWithUndo.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { PageMenuSection } from "../menus/PageMenuSection.js";
import {
  TEMPLATE_CHOICE_KEY,
  TemplateChoiceSection,
} from "../liquid-templates/TemplateChoiceSection.js";
import { EntryBreadcrumbs } from "./EntryBreadcrumbs.js";

interface EntryEditorProps {
  collection: Collection;
  blueprint: Blueprint;
  /** Undefined for a new entry. */
  initialEntry: Entry | undefined;
  onCreated: (entry: Entry) => void;
  /** The language a new entry is written in. Undefined is the site's main language. */
  locale?: string;
  /** "children" shows the items listed under it (a Blog page's posts), from the address. */
  tab?: WorkspaceTab;
  onTabChange?: (tab: WorkspaceTab) => void;
  /** The preview beside the fields, kept in the address so it survives a reload. */
  isPreviewOpen?: boolean;
  onPreviewChange?: (isOpen: boolean) => void;
}

/**
 * The entry editor, the same for a new entry and an old one: breadcrumbs and actions along
 * the top, the title and the blueprint's fields (a page's design first) in a calm document,
 * and the entry's status, place, menus, search settings and history in a side panel. It
 * saves as people type, and keeps the content tree up to date as it does.
 */
export function EntryEditor({
  collection,
  blueprint,
  initialEntry,
  onCreated,
  locale,
  tab,
  onTabChange,
  isPreviewOpen: isPreviewOpenInAddress = false,
  onPreviewChange,
}: EntryEditorProps) {
  const [state, dispatch] = useReducer(entryDraftReducer, initialEntry, (entry) =>
    initialDraftState(entry, defaultValues(blueprint.fields)),
  );
  const [companion, setCompanionState] = useState<Companion>(
    isPreviewOpenInAddress ? "preview" : "panel",
  );
  const setCompanion = (next: Companion | ((current: Companion) => Companion)) => {
    const value = typeof next === "function" ? next(companion) : next;
    setCompanionState(value);
    if ((value === "preview") !== (companion === "preview")) onPreviewChange?.(value === "preview");
  };
  const [isShowingDetails, setIsShowingDetails] = useState(false);
  const isPanelOpen = companion === "panel";
  const isPreviewOpen = companion === "preview";
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isCopyingToSite, setIsCopyingToSite] = useState(false);
  const currentSite = useCurrentSite();
  const otherSites =
    currentSite?.sites.filter((site) => site.handle !== currentSite.site.handle) ?? [];
  const [isStartingDesign, setIsStartingDesign] = useState(false);
  // A new entry's id, as soon as its first save returns, for opening it in the builder.
  const createdEntryId = useRef<string | undefined>(undefined);
  const documentElement = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const previewId = useId();
  const navigate = useNavigate();
  const showToast = useToast();
  const recycle = useRecycleWithUndo();

  const actions = useEntryActions({
    collectionHandle: collection.handle,
    initialEntry,
    dispatch,
    saved: state.saved,
    onCreated: (created) => {
      createdEntryId.current = created.id;
      onCreated(created);
    },
    locale,
    onPublishBlocked: (error) => focusFirstFieldError(error),
  });
  const { entry } = actions;
  const info = useEntryInfo(entry?.id);
  const refresh = useRefreshContent();
  const canPublish = useCan("entries:publish");
  const site = useViewPageSite();
  const viewPage = entry ? viewPageTarget(site, collection, entry, info.data?.url) : undefined;
  const address = entryAddressPattern(collection.routePattern, entry?.slug ?? "", info.data);
  // A page with pages under it that are listed here rather than in the tree (a Blog page).
  const listsChildren =
    entry !== undefined &&
    (info.data?.childCount ?? 0) > 0 &&
    (info.data?.childrenAsCollection ?? false);
  const showsChildren = listsChildren && tab === "children";
  const canDelete = useCan("entries:delete");
  const canCreate = useCan("entries:create");
  const canSave = useCan(entry ? "entries:update" : "entries:create");

  const isUnsaved = hasUnsavedChanges(state);
  const title = textValue(state.current.data[titleFieldHandle]);
  const titleField = blueprint.fields.find((field) => field.handle === titleFieldHandle);
  // Pages are designed visually: a blueprint with a page field leads with its design.
  const designField = blueprint.fields.find((field) => field.type === "page");
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
    save: async (draft, options) => {
      const saved = await actions.save(draft, options);
      // The tree shows the name and the "changed since publishing" dot.
      void refresh();
      return saved;
    },
  });
  const leaveWarning = useLeaveWarning(isUnsaved);

  function focusFirstFieldError(error: unknown) {
    focusFieldProblem(fieldErrorsFrom(error));
  }

  function focusFieldProblem(errors: FieldMessages) {
    const handle = firstFieldWithError(handlesInOrder, errors);
    if (handle && documentElement.current) {
      // A block opens when it has a problem, so wait a frame for its fields to be drawn.
      const container = documentElement.current;
      requestAnimationFrame(() => focusField(container, focusTargetFor(handle, errors)));
    }
  }

  /**
   * Saves now (a new entry is created even if untouched), moving focus to any problem.
   * `saveVersion` (Cmd/Ctrl+S and the Save button) keeps the save as a version in History.
   */
  async function saveExplicitly({ saveVersion = false } = {}): Promise<boolean> {
    try {
      await saveNow({ force: entry === undefined || saveVersion, saveVersion });
      return true;
    } catch (error) {
      focusFirstFieldError(error);
      return false;
    }
  }

  /** A new page: save it (it has a title), then open it in the builder. */
  async function startDesigning() {
    if (!designField || title.trim() === "" || isStartingDesign) return;
    setIsStartingDesign(true);
    const saved = await saveExplicitly();
    const entryId = entry?.id ?? createdEntryId.current;
    if (!saved || !entryId) {
      setIsStartingDesign(false);
      return;
    }
    await navigate({
      to: "/content/$collection/$entryId/design/$field",
      params: { collection: collection.handle, entryId, field: designField.handle },
      ignoreBlocker: true,
    });
  }

  async function afterPublishing(succeeded: boolean) {
    if (succeeded) await refresh(entry ? [entry.id] : []);
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

  async function publish() {
    if (entry && entry.status !== "published" && unpublishedAncestors.length > 0) {
      setParentQuestion({ isWorking: false, error: null });
      return;
    }
    await saveAndPublish();
  }

  async function publishWithParent() {
    setParentQuestion({ isWorking: true, error: null });
    try {
      const result = await runBulkAction(
        "publish",
        unpublishedAncestors.map((ancestor) => ancestor.id),
      );
      const [skipped] = result.skipped;
      await refresh(result.changed);
      if (skipped) {
        const message = t("workspace.parentUnpublished.failed", {
          title: skipped.title || t("editor.untitled"),
          reason: skipped.reason,
        });
        setParentQuestion({ isWorking: false, error: message });
        return;
      }
    } catch (failure) {
      setParentQuestion({ isWorking: false, error: describeError(failure) });
      return;
    }
    setParentQuestion(null);
    await saveAndPublish();
  }

  /** Saves first, so the copy has the latest changes, then opens the copy. */
  async function duplicateEntry() {
    if (!(await saveExplicitly())) return;
    const copy = await actions.duplicate();
    if (!copy) return;
    await navigate({
      to: "/content/$collection/$entryId",
      params: { collection: collection.handle, entryId: copy.id },
    });
  }

  /** Saves first, so the copy has the latest changes. */
  async function startCopyToSite() {
    if (await saveExplicitly()) setIsCopyingToSite(true);
  }

  async function openCopy(copyId: string, siteHandle: string) {
    setIsCopyingToSite(false);
    await currentSite?.switchSite(siteHandle);
    await navigate({
      to: "/content/$collection/$entryId",
      params: { collection: collection.handle, entryId: copyId },
      ignoreBlocker: true,
    });
  }

  /** To the recycle bin, then back to the list, with a note offering Undo. */
  async function deleteEntry() {
    await actions.remove((id) =>
      recycle(id, title || t("editor.untitled"), {
        notify: showToast,
        afterRecycle: async () => {
          setIsConfirmingDelete(false);
          await navigate({
            to: "/content/$collection",
            params: { collection: collection.handle },
            ignoreBlocker: true,
          });
        },
        afterUndo: async (entryId) => {
          await navigate({
            to: "/content/$collection/$entryId",
            params: { collection: collection.handle, entryId },
          });
        },
      }),
    );
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

  return (
    <div className={classNames("w-full", editorWidths[companion])}>
      <h1 className="sr-only">{title || t("editor.untitled")}</h1>

      <EntryEditorBar
        breadcrumbs={<EntryBreadcrumbs collection={collection} entryId={entry?.id} title={title} />}
        onShowDetails={entry ? () => setIsShowingDetails(true) : undefined}
        isPanelOpen={isPanelOpen}
        panelId={panelId}
        onTogglePanel={() => setCompanion((current) => (current === "panel" ? "none" : "panel"))}
        viewPage={viewPage}
        onDelete={entry && canDelete ? () => setIsConfirmingDelete(true) : undefined}
        onDuplicate={entry && canCreate ? () => void duplicateEntry() : undefined}
        onCopyToSite={
          entry && canCreate && otherSites.length > 0 && collection.siteScope !== "shared"
            ? () => void startCopyToSite()
            : undefined
        }
        isPreviewOpen={isPreviewOpen}
        previewId={previewId}
        onTogglePreview={() =>
          setCompanion((current) => (current === "preview" ? "panel" : "preview"))
        }
        saveIndicator={
          <SaveIndicator
            status={state.saveStatus}
            hasUnsavedChanges={isUnsaved}
            errorMessage={state.saveError}
            onRetry={() => void saveExplicitly()}
            fieldProblemCount={countFieldsWithErrors(state.fieldErrors)}
            onShowProblems={() => focusFieldProblem(state.fieldErrors)}
          />
        }
        primaryAction={
          canPublish ? (
            <PublishButton
              entry={entry}
              hasUnsavedChanges={isUnsaved}
              // A new entry has nothing to publish until it has a title.
              disabled={actions.isWorking || (entry === undefined && title.trim() === "")}
              onPublish={() => void publish()}
            />
          ) : (
            <Button
              onClick={() => void saveExplicitly({ saveVersion: true })}
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

      {listsChildren && (
        <div className="mb-5">
          <SegmentedControl
            label={t("workspace.tabs", { title: title || t("editor.untitled") })}
            options={[
              { value: "content", label: t("workspace.tab.content") },
              { value: "children", label: t("workspace.tab.children") },
            ]}
            value={showsChildren ? "children" : "content"}
            onChange={(next) => onTabChange?.(next)}
          />
        </div>
      )}

      {showsChildren && entry ? (
        <CollectionView
          place={{ parentId: entry.id }}
          placeName={title || t("editor.untitled")}
          allLevels={false}
        />
      ) : (
        <div className={classNames("grid items-start", editorColumns[companion])}>
          <div
            ref={documentElement}
            // The document sits on a white page over the grey desk, like a document in Pages.
            className="flex min-w-0 flex-col gap-9 rounded-panel bg-surface px-9 pt-8 pb-10"
          >
            <div className="flex flex-col gap-1">
              <EntryTitleInput
                label={titleField?.label ?? t("editor.titleFallback")}
                onSubmit={designField && !entry ? () => void startDesigning() : undefined}
                value={title}
                onChange={(value) =>
                  dispatch({ type: "fieldChanged", handle: titleFieldHandle, value })
                }
                error={state.fieldErrors[titleFieldHandle]}
              />
              <EntrySlugInput
                routePattern={address.pattern}
                fixedAddress={address.fixedAddress}
                slug={state.current.slug}
                onChange={(slug) => dispatch({ type: "slugChanged", slug })}
                error={state.fieldErrors.slug}
                viewPage={viewPage}
              />
            </div>

            {designField ? (
              <DesignFirstFields
                key={state.formVersion}
                designField={designField}
                fields={blueprint.fields}
                data={state.current.data}
                errors={state.fieldErrors}
                onChange={(handle, value) => dispatch({ type: "fieldChanged", handle, value })}
                collectionHandle={collection.handle}
                entryId={entry?.id}
                hasTitle={title.trim() !== ""}
                onStartDesigning={() => void startDesigning()}
                isStarting={isStartingDesign}
              />
            ) : (
              <EntryFields
                key={state.formVersion}
                fields={blueprint.fields}
                data={state.current.data}
                errors={state.fieldErrors}
                onChange={(handle, value) => dispatch({ type: "fieldChanged", handle, value })}
              />
            )}
          </div>

          {isPanelOpen && (
            <EntrySidePanel
              id={panelId}
              collection={collection}
              entry={entry}
              locale={entry?.locale ?? locale}
              parentId={state.current.parentId}
              onParentChange={(parentId) => dispatch({ type: "parentChanged", parentId })}
              canPublish={canPublish}
              isWorking={actions.isWorking}
              onUnpublish={() => void actions.unpublish().then(afterPublishing)}
              onSchedule={(publishAt) =>
                void saveExplicitly().then(
                  async (saved) => saved && afterPublishing(await actions.schedule(publishAt)),
                )
              }
              onRestore={async (revisionId) => {
                await actions.restore(revisionId);
                await refresh(entry ? [entry.id] : []);
              }}
            >
              {Boolean(collection.routePattern) && (
                <TemplateChoiceSection
                  collection={collection}
                  value={state.current.data[TEMPLATE_CHOICE_KEY]}
                  onChange={(value) =>
                    dispatch({ type: "fieldChanged", handle: TEMPLATE_CHOICE_KEY, value })
                  }
                />
              )}
              {entry && collection.structure === "tree" && Boolean(collection.routePattern) && (
                <PageMenuSection entryId={entry.id} pageTitle={title || t("editor.untitled")} />
              )}
              <PluginEditorPanels
                entryId={entry?.id}
                entryTitle={title}
                slug={state.current.slug}
                collection={{
                  handle: collection.handle,
                  name: collection.name,
                  routePattern: collection.routePattern,
                }}
              />
            </EntrySidePanel>
          )}

          {isPreviewOpen && (
            <EntryPreviewPane
              id={previewId}
              collection={collection}
              entry={entry}
              fields={blueprint.fields}
              title={title}
              onClose={() => setCompanion("panel")}
            />
          )}
        </div>
      )}

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

      {entry && (
        <Dialog
          open={isShowingDetails}
          onClose={() => setIsShowingDetails(false)}
          title={t("editor.details")}
          size="sheet"
        >
          <InfoTab entry={entry} collection={collection} info={info} />
        </Dialog>
      )}

      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("editor.deleteTitle", { title: title || t("editor.untitled") })}
        message={t("editor.deleteMessage")}
        confirmLabel={t("tree.delete.confirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={actions.isWorking}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => void deleteEntry()}
      />

      {isCopyingToSite && entry && (
        <CopyToSiteDialog
          entryId={entry.id}
          sites={otherSites}
          onCopied={(copyId, site) => void openCopy(copyId, site.handle)}
          onClose={() => setIsCopyingToSite(false)}
        />
      )}

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

  if (entry && isLive && !hasNewerEdits) {
    return <PageStatus entry={entry} state="live" />;
  }

  return (
    <Button onClick={onPublish} disabled={disabled}>
      {isLive ? t("editor.publishChanges") : t("editor.publish")}
    </Button>
  );
}
