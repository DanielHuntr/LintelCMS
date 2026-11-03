import { useEntryReviewState } from "../client-editing/clientEditing.queries.js";
import { SendForReviewButton, SentBackNote } from "../client-editing/SendForReview.js";
import {
  type CanvasSite,
  type FileUploader,
  PageBuilder,
  type ImagePicker,
  type PickedImage,
  type PictureUploader,
} from "@lintel/builder";
import { usePageFinder, usePagePicker } from "../page-links/usePagePicker.js";
import {
  createEmptyPage,
  type PageDocument,
  standardCatalogue,
  validatePageDocument,
} from "@lintel/builder-model";
import { defaultTheme, themeStylesheet } from "@lintel/site-components";
// The site's component styles, so the canvas shows blocks exactly as the site does.
import siteStylesheet from "@lintel/site-components/styles.css?raw";
import type { MotionEditorStringKey } from "@lintel/motion-editor";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, MonitorSmartphone, SquareArrowOutUpRight } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { apiUrl } from "../api/client.js";
import { LoadError } from "../api/LoadError.js";
import { useCollection, useEntry } from "../content/content.queries.js";
import type { Entry } from "../content/content.types.js";
import { SaveIndicator } from "../content/SaveIndicator.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { useEntryInfo } from "../content-tree/contentTree.queries.js";
import { viewPageTarget } from "../content/viewPage.js";
import { ViewPageLink } from "../content/ViewPageLink.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { buttonClasses } from "../design/Button.js";
import { useIsNarrowScreen } from "../design/useIsNarrowScreen.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { type StringKey, t } from "../i18n/strings.js";
import { getAsset, uploadAsset } from "../media/media.api.js";
import { MediaPickerDialog } from "../media/MediaPickerDialog.js";
import { uploadPicture } from "../media/uploadPicture.js";
import { usePhotoCredits } from "./usePhotoCredits.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { runtimeSettings } from "../runtime-settings.js";
import { useBuilderData, useCanvasSite, useViewPageSite } from "../website/website.queries.js";
import { useEffectModules } from "./useEffectModules.js";
import { useBuilderBlocks } from "../blocks/useBuilderBlocks.js";
import { usePageDesignSaving } from "./usePageDesignSaving.js";
import { SitePartProblems } from "./SitePartProblems.js";
import { useSiteDesign } from "./useSiteDesign.js";
import { useSiteMotion } from "./useSiteMotion.js";
import { type SiteSectionsState, useSiteSections } from "./useSiteSections.js";
import { markCurrentPage, useBuilderMenus } from "../menus/builderMenus.js";
import { InlineMenuEditor } from "../menus/InlineMenuEditor.js";
import { useBuilderFonts } from "../site-fonts/useBuilderFonts.js";
import { usePageDrafting } from "../page-drafts/usePageDrafting.js";
import { useExperimentsInDesigner } from "../experiments/useExperimentsInDesigner.js";
import { BuilderVisitorsLine } from "../analytics/BuilderVisitorsLine.js";
import { PageStatus, pageStateOf } from "../content-workspace/PageStatus.js";
import {
  PagePreviewButton,
  PagePublishButton,
  PageViewLink,
  PageViewSwitch,
} from "../page-home/PageBarParts.js";
import { pageViews, publishState } from "../page-home/pageViews.js";
import { useViewSwitch } from "../page-home/useViewSwitch.js";
import { createEntryPreview } from "../preview/preview.api.js";

/**
 * The canvas frame's scripts, served beside the admin (see vite.config.ts), because the
 * admin's Content-Security-Policy refuses inline scripts and the frame inherits it.
 */
export const besideTheAdmin = (file: string) =>
  new URL(
    `${runtimeSettings.basePath.replace(/\/?$/, "/")}${file}`,
    globalThis.location?.origin ?? "http://localhost",
  ).href;
export const canvasFrameScripts = {
  frame: besideTheAdmin("canvas-frame.js"),
  motion: besideTheAdmin("canvas-motion.js"),
};

interface PageDesignPageProps {
  collectionHandle: string;
  entryId: string;
  fieldHandle: string;
}

/** "Edit design": the visual builder, full screen, for one page field of one entry. */
export function PageDesignPage({ collectionHandle, entryId, fieldHandle }: PageDesignPageProps) {
  const entry = useEntry(entryId);
  // The canvas waits for the website's look, so the page never jumps from one look to another.
  // If it can't be had, the canvas uses the default theme instead.
  const canvasSite = useCanvasSite();
  // The site's navigation and footer open inside the page, so the builder waits for them too.
  const siteSections = useSiteSections();
  if (entry.isError) return <LoadError error={entry.error} onRetry={() => void entry.refetch()} />;
  if (!entry.data || canvasSite.isPending || siteSections.isLoading) {
    return (
      <LoadingRegion label={t("pageDesign.loading")}>
        {/* The shape of what's coming, so the switch from the page's Content view doesn't jump. */}
        <div className="flex h-dvh flex-col bg-background">
          <div className="flex h-12 shrink-0 items-center gap-3 hairline-bottom bg-surface px-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="ms-auto h-8 w-24" />
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="w-72 shrink-0 border-e border-separator bg-surface" />
            <div className="flex-1 p-4">
              <Skeleton className="size-full" />
            </div>
          </div>
        </div>
      </LoadingRegion>
    );
  }
  return (
    <PageDesigner
      key={entry.data.id}
      entry={entry.data}
      collectionHandle={collectionHandle}
      fieldHandle={fieldHandle}
      site={canvasSite.data}
      siteSections={siteSections}
    />
  );
}

function PageDesigner({
  entry: loadedEntry,
  collectionHandle,
  fieldHandle,
  site,
  siteSections: shared,
}: {
  entry: Entry;
  collectionHandle: string;
  fieldHandle: string;
  site: CanvasSite | undefined;
  siteSections: SiteSectionsState;
}) {
  const siteSections = shared.source;
  const field = loadedEntry.blueprint.fields.find(
    (candidate) => candidate.handle === fieldHandle && candidate.type === "page",
  );
  const opened = useMemo(
    () => openDesign(loadedEntry.data[fieldHandle]),
    [loadedEntry, fieldHandle],
  );
  // Publishing the page also puts the navigation and footer changes live, for those who
  // may change them.
  const canPublishShared = useCan("builder:blocks");
  const saving = usePageDesignSaving(
    loadedEntry,
    fieldHandle,
    canPublishShared ? shared.publish : undefined,
  );
  const session = useSession();
  // A/B tests: Version B and C of the page open on the same canvas (see src/experiments).
  const experiments = useExperimentsInDesigner({
    entryId: loadedEntry.id,
    fieldHandle,
    original: "document" in opened ? opened.document : null,
    saveOriginal: saving.saveNow,
  });
  // The page as it is now, for the pictures and server-drawn HTML its blocks need.
  const [currentRoot, setCurrentRoot] = useState<PageDocument["root"] | null>(
    "document" in opened ? opened.document.root : null,
  );
  const changeSavedDesign = saving.change;
  const changeExperimentDesign = experiments.change;
  const changeDesign = useCallback(
    (document: PageDocument) => {
      setCurrentRoot(document.root);
      if (!changeExperimentDesign(document)) changeSavedDesign(document);
    },
    [changeSavedDesign, changeExperimentDesign],
  );
  const blocks = useBuilderBlocks({ root: currentRoot, beforeLeaving: saving.saveNow });
  const pageDrafting = usePageDrafting();
  const leave = useLeaveWarning(saving.hasUnsavedChanges || experiments.hasUnsavedChanges);
  // Collection lists and shop elements show real entries on the canvas once this arrives.
  const builderData = useBuilderData();
  // Headers and menus on the canvas show the site's real menus, and edit them in place.
  const builderMenus = useBuilderMenus();
  // Credits under Picture elements, as the website shows them.
  const photoCredits = usePhotoCredits(currentRoot);
  const dataSources = useMemo(() => {
    const menus = builderMenus.data && markCurrentPage(builderMenus.data, loadedEntry.id);
    if (!builderData.data && !menus && !photoCredits) return undefined;
    return {
      ...(builderData.data ?? { collections: [], forms: [], products: [], productCollections: [] }),
      menus,
      photoCredits,
    };
  }, [builderData.data, builderMenus.data, photoCredits, loadedEntry.id]);
  const canEditCode = useCan("builder:code");
  const canPublish = useCan("entries:publish");
  // Clients change only the content their designer opened up (see src/client-editing).
  const contentOnly = !useCan("builder:design");
  const reviewState = useEntryReviewState(saving.entry.id);
  const mustSendForReview = reviewState.data?.mustSendForReview === true;
  const collection = useCollection(collectionHandle);
  const viewPageSite = useViewPageSite();
  // The server's address knows the page's place in the tree ("/about/team").
  const entryInfo = useEntryInfo(saving.entry.id);
  const viewPage = collection.data
    ? viewPageTarget(viewPageSite, collection.data, saving.entry, entryInfo.data?.url)
    : undefined;
  const effectModules = useEffectModules(besideTheAdmin);
  const siteMotion = useSiteMotion();
  const siteDesign = useSiteDesign({ entry: saving.entry.id });
  const imagePicker = useImagePicker();
  const fonts = useBuilderFonts();
  const pagePicker = usePagePicker();
  const findPage = usePageFinder();
  const isNarrowScreen = useIsNarrowScreen();
  const navigate = useNavigate();
  const finishEditing = useRef<(() => Promise<void>) | null>(null);
  const views = pageViews({
    canOpenDesign: true,
    isNarrowScreen,
    listsChildren:
      (entryInfo.data?.childCount ?? 0) > 0 && (entryInfo.data?.childrenAsCollection ?? false),
  });

  /** Everything open here: the page or version, the site's styles, its menu and footer. */
  async function saveEverything() {
    await finishEditing.current?.();
    // What was typed passes through the builder's state to the saving hooks in a few renders.
    for (let render = 0; render < 3; render += 1) {
      await new Promise((resolve) => setTimeout(resolve));
    }
    const results = await Promise.all([
      saving.saveBeforeLeaving(),
      experiments.saveBeforeLeaving(),
      siteDesign.saveNow(),
      shared.saveNow(),
    ]);
    return results.every(Boolean);
  }

  // The other views are the page screen. All of it is saved first, so nothing asks; if any of
  // it can't be, the person stays here with their work.
  const viewSwitch = useViewSwitch({
    current: "design",
    saveFirst: saveEverything,
    go: (view) =>
      navigate({
        to: "/content/$collection/$entryId",
        params: { collection: collectionHandle, entryId: saving.entry.id },
        search: { locale: undefined, tab: view === "children" ? view : undefined },
        ignoreBlocker: true,
      }),
  });

  /** The saved draft as the website draws it, in a new tab, or else beside the page's fields. */
  async function openPreview() {
    await finishEditing.current?.();
    await saving.saveNow();
    const preview = await createEntryPreview(saving.entry.id).catch(() => null);
    const opened = preview?.previewUrl ? window.open(preview.previewUrl, "_blank") : null;
    if (opened) return;
    await navigate({
      to: "/content/$collection/$entryId",
      params: { collection: collectionHandle, entryId: saving.entry.id },
      search: { locale: undefined, preview: true },
    });
  }

  const title = String(saving.entry.data.title ?? "") || t("pageDesign.untitled");
  const text = useCallback(
    (key: string, values?: Readonly<Record<string, string | number>>) =>
      t(key as StringKey, values),
    [],
  );
  const motionText = useCallback(
    (key: MotionEditorStringKey, values?: Readonly<Record<string, string | number>>) =>
      t(key, values),
    [],
  );

  // Shared menus and footers go live with the page, for those allowed to change them.
  const showsSitePartsNote =
    canPublish &&
    canPublishShared &&
    shared.unpublished &&
    !saving.justPublished &&
    saving.liveness === "live";

  // Someone else's newer styles explain themselves, and what's on screen has changed.
  const isStylesConflict = siteDesign.problem?.retryLabel !== undefined;
  const showsSwitchProblem =
    viewSwitch.didFail &&
    !isStylesConflict &&
    (saving.status === "failed" ||
      experiments.hasUnsavedChanges ||
      siteDesign.problem !== null ||
      shared.problem !== null);

  if (!field)
    return (
      <p className="p-8 text-body text-label">
        {t("pageDesign.notAPageField", { field: fieldHandle })}
      </p>
    );
  if ("problem" in opened)
    return (
      <p className="p-8 text-body text-label">
        {t("pageDesign.unreadable", { problem: opened.problem })}
      </p>
    );
  // The canvas, panels and toolbar need a laptop's width; on a phone it spilled off the
  // screen, so say so and offer what works there (LINTEL-UX-013).
  if (isNarrowScreen)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="mb-1 flex size-16 items-center justify-center rounded-full bg-fill text-label-secondary">
          <MonitorSmartphone aria-hidden="true" strokeWidth={1.5} className="size-7" />
        </span>
        <h1 className="text-title text-label">{t("pageDesign.narrow.title")}</h1>
        <p className="max-w-md text-body text-balance text-label-secondary">
          {t("pageDesign.narrow.description")}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {viewPage && (
            <ViewPageLink target={viewPage} className={buttonClasses("filled", "medium")}>
              <SquareArrowOutUpRight aria-hidden="true" className="size-4" />
              {t("editor.viewPage")}
            </ViewPageLink>
          )}
          <Link
            to="/content/$collection/$entryId"
            params={{ collection: collectionHandle, entryId: saving.entry.id }}
            search={{ locale: undefined }}
            className={buttonClasses("tinted", "medium")}
          >
            {t("pageDesign.back", { title })}
          </Link>
        </div>
      </main>
    );

  return (
    <>
      <PageBuilder
        key={experiments.editing}
        initialDocument={experiments.initialDocument ?? opened.document}
        onChange={changeDesign}
        onSelectionChange={experiments.select}
        title={title}
        toolbarTitleNote={
          <PageStatus
            entry={saving.entry}
            state={pageStateOf(saving.entry, saving.hasUnsavedChanges)}
            note={showsSitePartsNote ? t("pageDesign.siteSections.notLive") : undefined}
          />
        }
        finishEditingRef={finishEditing}
        toolbarAfterTitle={
          <PageViewSwitch
            pageTitle={title}
            views={views}
            view="design"
            canDesign={!contentOnly}
            onChange={(view) => void viewSwitch.request(view)}
          />
        }
        canEditCode={canEditCode}
        contentOnly={contentOnly}
        site={site}
        dataSources={dataSources}
        menuEditor={renderMenuEditor}
        blocks={blocks}
        enabledPlugins={session.enabledPlugins}
        themeStylesheet={themeStylesheet(defaultTheme)}
        baseStylesheet={siteStylesheet}
        text={text}
        motionText={motionText}
        pickImage={imagePicker.pick}
        pickPage={pagePicker.pick}
        findPage={findPage}
        uploadFile={uploadToMediaLibrary}
        onAddFont={fonts.onAddFont}
        onMoveFontToSite={fonts.onMoveFontToSite}
        uploadPicture={uploadPictureToMediaLibrary}
        sampleModelsUrl={`${apiUrl}/media/sample-models`}
        onSaveNow={experiments.isEditingVersion ? experiments.saveNow : saving.saveNow}
        frameScripts={canvasFrameScripts}
        effectModules={effectModules}
        siteEffects={siteMotion}
        siteDesign={siteDesign.source}
        siteSections={siteSections}
        pageDrafting={pageDrafting}
        toolbarStart={
          <Link
            to="/content/$collection/$entryId"
            params={{ collection: collectionHandle, entryId: saving.entry.id }}
            search={{ locale: undefined }}
            aria-label={t("pageDesign.back", { title })}
            className="flex size-8 shrink-0 items-center justify-center rounded-control text-accent hover:bg-fill focus-visible:focus-ring"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
        }
        toolbarEnd={
          <div className="ms-2 flex items-center gap-3" data-tour="publish">
            {experiments.switcher}
            {experiments.isEditingVersion ? (
              experiments.saveState
            ) : (
              <>
                <SaveIndicator
                  status={saving.status}
                  hasUnsavedChanges={saving.hasUnsavedChanges}
                  errorMessage={saving.errorMessage}
                  onRetry={saving.saveNow}
                />
                <BuilderVisitorsLine entryId={saving.entry.id} />
                <span role="status" className="sr-only">
                  {saving.justPublished ? t("pageDesign.publishedAnnouncement") : ""}
                </span>
                {viewPage && <PageViewLink target={viewPage} />}
                <PagePreviewButton onClick={() => void openPreview()} />
                {canPublish && mustSendForReview && reviewState.data && (
                  <SendForReviewButton
                    entryId={saving.entry.id}
                    state={reviewState.data}
                    beforeSending={saving.saveNow}
                    look="toolbar"
                  />
                )}
                {canPublish && !mustSendForReview && (
                  <PagePublishButton
                    state={publishState({
                      isLive: saving.entry.status === "published",
                      hasNewerChanges: saving.liveness !== "live" || showsSitePartsNote,
                      isPublishing: saving.isPublishing,
                      justPublished: saving.justPublished,
                    })}
                    onPublish={() => void saving.publish()}
                  />
                )}
              </>
            )}
          </div>
        }
      />
      {saving.status === "failed" && saving.errorMessage && (
        <p
          role="alert"
          className="fixed bottom-4 left-1/2 z-40 max-w-xl -translate-x-1/2 rounded-card bg-surface-raised px-4 py-3 text-footnote text-danger shadow-float"
        >
          {saving.errorMessage}
        </p>
      )}
      <SentBackNote
        state={reviewState.data}
        className="fixed bottom-4 left-4 z-30 max-w-md shadow-float"
      />
      {experiments.dialogs}
      <SitePartProblems
        problems={[
          showsSwitchProblem ? { message: t("pageHome.switch.notSaved") } : null,
          siteDesign.problem,
          shared.problem,
        ]}
      />
      {imagePicker.dialog}
      {fonts.dialogs}
      {pagePicker.dialog}
      <ConfirmDialog
        open={leave.isAsking}
        title={t("editor.leaveTitle")}
        message={t("editor.leaveMessage")}
        confirmLabel={t("editor.leave")}
        cancelLabel={t("editor.stay")}
        isDestructive
        onConfirm={leave.leave}
        onCancel={leave.stay}
      />
    </>
  );
}

/** The stored design, migrated and checked; an empty page if there isn't one yet. */
function openDesign(stored: unknown): { document: PageDocument } | { problem: string } {
  if (stored === null || stored === undefined) return { document: createEmptyPage() };
  const checked = validatePageDocument(stored, standardCatalogue);
  return checked.ok
    ? { document: checked.document }
    : { problem: checked.problems[0]?.message ?? "" };
}

/** The media library as a promise: `pick()` opens it and resolves with the chosen picture. */
/** Fonts and videos for the builder go into the media library like any other file. */
export const uploadToMediaLibrary: FileUploader = async (file) => {
  const asset = await uploadAsset(file, () => undefined).catch(() => null);
  return asset
    ? { assetId: asset.id, src: asset.url, mimeType: asset.mimeType, filename: asset.filename }
    : null;
};

/** Pictures dropped on, or pasted into, a Picture element on the canvas. */
const uploadPictureToMediaLibrary: PictureUploader = async (file) => {
  const asset = await uploadPicture(file);
  return { assetId: asset.id, src: asset.url, alt: asset.alt };
};

export function useImagePicker() {
  const [request, setRequest] = useState<Parameters<ImagePicker>[0] | null>(null);
  const resolver = useRef<((picked: PickedImage | null) => void) | null>(null);

  const finish = (picked: PickedImage | null) => {
    resolver.current?.(picked);
    resolver.current = null;
    setRequest(null);
  };

  const pick = useCallback((next: Parameters<ImagePicker>[0]) => {
    setRequest(next);
    return new Promise<PickedImage | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = request ? (
    <MediaPickerDialog
      fieldLabel={request.label}
      currentAssetId={request.currentAssetId}
      kind={request.kind}
      onClose={() => finish(null)}
      onChoose={async (assetId) => {
        const asset = await getAsset(assetId).catch(() => null);
        finish(asset ? { assetId, src: asset.url, alt: asset.alt, bytes: asset.size } : null);
      }}
    />
  ) : null;

  return { pick, dialog };
}

/** The menu editor the builder shows in its Content tab for a Header, Menu or Menu drawer. */
function renderMenuEditor({ menuHandle, onClose }: { menuHandle: string; onClose: () => void }) {
  return <InlineMenuEditor handle={menuHandle} onClose={onClose} />;
}
