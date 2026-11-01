import { type CanvasSite, type FileUploader, PageBuilder, type PickedImage } from "@lintel/builder";
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
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { useEntry } from "../content/content.queries.js";
import type { Entry } from "../content/content.types.js";
import { SaveIndicator } from "../content/SaveIndicator.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { type StringKey, t } from "../i18n/strings.js";
import { getAsset, uploadAsset } from "../media/media.api.js";
import { MediaPickerDialog } from "../media/MediaPickerDialog.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { runtimeSettings } from "../runtime-settings.js";
import { useBuilderData, useCanvasSite } from "../website/website.queries.js";
import { usePageDesignSaving } from "./usePageDesignSaving.js";

/**
 * The canvas frame's scripts, served beside the admin (see vite.config.ts), because the
 * admin's Content-Security-Policy refuses inline scripts and the frame inherits it.
 */
const besideTheAdmin = (file: string) =>
  new URL(
    `${runtimeSettings.basePath.replace(/\/?$/, "/")}${file}`,
    globalThis.location?.origin ?? "http://localhost",
  ).href;
const canvasFrameScripts = {
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
  if (entry.isError) return <LoadError error={entry.error} onRetry={() => void entry.refetch()} />;
  if (!entry.data || canvasSite.isPending) {
    return (
      <LoadingRegion label={t("pageDesign.loading")}>
        <div className="flex h-dvh flex-col gap-3 p-3">
          <Skeleton className="h-10" />
          <Skeleton className="flex-1" />
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
    />
  );
}

function PageDesigner({
  entry: loadedEntry,
  collectionHandle,
  fieldHandle,
  site,
}: {
  entry: Entry;
  collectionHandle: string;
  fieldHandle: string;
  site: CanvasSite | undefined;
}) {
  const field = loadedEntry.blueprint.fields.find(
    (candidate) => candidate.handle === fieldHandle && candidate.type === "page",
  );
  const opened = useMemo(
    () => openDesign(loadedEntry.data[fieldHandle]),
    [loadedEntry, fieldHandle],
  );
  const saving = usePageDesignSaving(loadedEntry, fieldHandle);
  const leave = useLeaveWarning(saving.hasUnsavedChanges);
  const session = useSession();
  // Collection lists and shop elements show real entries on the canvas once this arrives.
  const builderData = useBuilderData();
  const canEditCode = useCan("builder:code");
  const canPublish = useCan("entries:publish");
  const imagePicker = useImagePicker();
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

  return (
    <>
      <PageBuilder
        initialDocument={opened.document}
        onChange={saving.change}
        title={title}
        canEditCode={canEditCode}
        site={site}
        dataSources={builderData.data}
        enabledPlugins={session.enabledPlugins}
        themeStylesheet={themeStylesheet(defaultTheme)}
        baseStylesheet={siteStylesheet}
        text={text}
        motionText={motionText}
        pickImage={imagePicker.pick}
        uploadFile={uploadToMediaLibrary}
        onSaveNow={saving.saveNow}
        frameScripts={canvasFrameScripts}
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
          <div className="ms-2 flex items-center gap-3">
            <SaveIndicator
              status={saving.status}
              hasUnsavedChanges={saving.hasUnsavedChanges}
              errorMessage={saving.errorMessage}
              onRetry={saving.saveNow}
            />
            {canPublish && (
              <button
                type="button"
                data-tour="publish"
                onClick={() => void saving.publish()}
                disabled={saving.isPublishing}
                className="h-8 rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring disabled:opacity-50"
              >
                {saving.isPublishing ? t("pageDesign.publishing") : t("pageDesign.publish")}
              </button>
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
      {imagePicker.dialog}
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
const uploadToMediaLibrary: FileUploader = async (file) => {
  const asset = await uploadAsset(file, () => undefined).catch(() => null);
  return asset
    ? { assetId: asset.id, src: asset.url, mimeType: asset.mimeType, filename: asset.filename }
    : null;
};

function useImagePicker() {
  const [request, setRequest] = useState<{ label: string; currentAssetId: string | null } | null>(
    null,
  );
  const resolver = useRef<((picked: PickedImage | null) => void) | null>(null);

  const finish = (picked: PickedImage | null) => {
    resolver.current?.(picked);
    resolver.current = null;
    setRequest(null);
  };

  const pick = useCallback((next: { label: string; currentAssetId: string | null }) => {
    setRequest(next);
    return new Promise<PickedImage | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = request ? (
    <MediaPickerDialog
      fieldLabel={request.label}
      currentAssetId={request.currentAssetId}
      onClose={() => finish(null)}
      onChoose={async (assetId) => {
        const asset = await getAsset(assetId).catch(() => null);
        finish(asset ? { assetId, src: asset.url, alt: asset.alt } : null);
      }}
    />
  ) : null;

  return { pick, dialog };
}
