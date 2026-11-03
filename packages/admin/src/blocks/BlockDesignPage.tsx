import { type CanvasSite, PageBuilder } from "@lintel/builder";
import {
  type BlockProperty,
  createEmptyPage,
  createRandomNodeId,
  type PageDocument,
  type PageNode,
} from "@lintel/builder-model";
import { defaultTheme, themeStylesheet } from "@lintel/site-components";
import siteStylesheet from "@lintel/site-components/styles.css?raw";
import type { MotionEditorStringKey } from "@lintel/motion-editor";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, MonitorSmartphone } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { blueprintKeys } from "../content-types/blueprints.queries.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { buttonClasses } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { useIsNarrowScreen } from "../design/useIsNarrowScreen.js";
import type { Field } from "../fields/field.types.js";
import { type StringKey, t } from "../i18n/strings.js";
import {
  besideTheAdmin,
  canvasFrameScripts,
  uploadToMediaLibrary,
  useImagePicker,
} from "../page-design/PageDesignPage.js";
import { useEffectModules } from "../page-design/useEffectModules.js";
import { useSiteDesign } from "../page-design/useSiteDesign.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { useCanvasSite } from "../website/website.queries.js";
import { withoutBindingsTo } from "./blockChanges.js";
import { asCustomBlock, fieldsAsProperties, type SiteBlock, updateBlock } from "./blocks.api.js";
import { blockKeys, useBlock } from "./blocks.queries.js";
import { useBuilderFonts } from "../site-fonts/useBuilderFonts.js";

/**
 * A block's design in the visual builder, full screen: the page is the design, elements can
 * show the block's properties (their Shows pickers list them), and **Choose what editors can
 * change** marks parts as properties. Saving changes every page that uses the block.
 */
export function BlockDesignPage({ handle }: { handle: string }) {
  const block = useBlock(handle);
  const canvasSite = useCanvasSite();
  if (block.isError) return <LoadError error={block.error} onRetry={() => void block.refetch()} />;
  if (!block.data || canvasSite.isPending) {
    return (
      <LoadingRegion label={t("blocks.loading")}>
        <div className="flex h-dvh flex-col gap-3 p-3">
          <Skeleton className="h-10" />
          <Skeleton className="flex-1" />
        </div>
      </LoadingRegion>
    );
  }
  if (!block.data.design) {
    return <p className="p-8 text-body text-label">{t("blocks.designReadOnly")}</p>;
  }
  return <BlockDesigner key={block.data.updatedAt} block={block.data} site={canvasSite.data} />;
}

function BlockDesigner({ block, site }: { block: SiteBlock; site: CanvasSite | undefined }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const canEdit = useCan("builder:blocks") && block.editable;
  const canEditCode = useCan("builder:code");
  const imagePicker = useImagePicker();
  const fonts = useBuilderFonts();
  const effectModules = useEffectModules(besideTheAdmin);
  const isNarrowScreen = useIsNarrowScreen();
  const siteDesign = useSiteDesign();
  const initial = useMemo(() => designAsPage(block.design as PageNode), [block.design]);
  const [document, setDocument] = useState<PageDocument>(initial);
  const [properties, setProperties] = useState<BlockProperty[]>(() =>
    fieldsAsProperties(block.properties),
  );
  const [status, setStatus] = useState<"saved" | "unsaved" | "saving" | "failed">("saved");
  const [problem, setProblem] = useState<string | null>(null);
  const [removal, setRemoval] = useState<{ properties: string[]; pages: string[] } | null>(null);
  const leave = useLeaveWarning(status === "unsaved" || status === "failed");

  const master = useMemo(
    () => ({
      block: { ...asCustomBlock(block), properties },
      isReadOnly: !canEdit,
      onPropertiesChange: (next: BlockProperty[]) => {
        setProperties(next);
        setStatus("unsaved");
      },
    }),
    [block, properties, canEdit],
  );
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

  async function save(confirmRemovals = false) {
    const design = designOf(document, block.name);
    if (!design) return;
    setStatus("saving");
    setProblem(null);
    const kept = new Set(properties.map((property) => property.handle));
    const removed = block.properties
      .map((property) => property.handle)
      .filter((old) => !kept.has(old));
    try {
      const updated = await updateBlock(block.handle, {
        name: block.name,
        icon: block.icon,
        category: block.category,
        description: block.description,
        properties: properties as unknown as Field[],
        design: withoutBindingsTo(design, removed),
        confirmRemovals,
      });
      queryClient.setQueryData(blockKeys.block(updated.handle), updated);
      void queryClient.invalidateQueries({ queryKey: blockKeys.blocks() });
      void queryClient.invalidateQueries({ queryKey: blueprintKeys.blueprints() });
      setStatus("saved");
    } catch (error) {
      if (error instanceof ApiError && error.code === "BLOCK_CHANGE_NEEDS_CONFIRMATION") {
        setRemoval({
          properties: (error.details.removedProperties as string[] | undefined) ?? [],
          pages: ((error.details.pages as Array<{ title: string }> | undefined) ?? []).map(
            (page) => page.title,
          ),
        });
        setStatus("unsaved");
        return;
      }
      setProblem(describeError(error));
      setStatus("failed");
    }
  }

  const title = t("blocks.designTitle", { name: block.name });
  // The canvas, panels and toolbar need a laptop's width, as page designs do (LINTEL-UX-013).
  if (isNarrowScreen)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="mb-1 flex size-16 items-center justify-center rounded-full bg-fill text-label-secondary">
          <MonitorSmartphone aria-hidden="true" strokeWidth={1.5} className="size-7" />
        </span>
        <h1 className="text-title text-label">{t("pageDesign.narrow.title")}</h1>
        <p className="max-w-md text-body text-balance text-label-secondary">
          {t("blocks.narrowDescription")}
        </p>
        <Link
          to="/design/blocks/$handle"
          params={{ handle: block.handle }}
          className={classNames("mt-2", buttonClasses("tinted", "medium"))}
        >
          {t("blocks.designBack", { name: block.name })}
        </Link>
      </main>
    );
  return (
    <>
      <PageBuilder
        initialDocument={initial}
        onChange={(next) => {
          setDocument(next);
          setStatus("unsaved");
        }}
        title={title}
        canEditCode={canEditCode}
        site={site}
        blocks={{ library: [], canManage: false }}
        blockMaster={master}
        siteDesign={siteDesign}
        enabledPlugins={session.enabledPlugins}
        themeStylesheet={themeStylesheet(defaultTheme)}
        baseStylesheet={siteStylesheet}
        text={text}
        motionText={motionText}
        pickImage={imagePicker.pick}
        uploadFile={uploadToMediaLibrary}
        onAddFont={fonts.onAddFont}
        onMoveFontToSite={fonts.onMoveFontToSite}
        onSaveNow={() => void save()}
        frameScripts={canvasFrameScripts}
        effectModules={effectModules}
        toolbarStart={
          <Link
            to="/design/blocks/$handle"
            params={{ handle: block.handle }}
            aria-label={t("blocks.designBack", { name: block.name })}
            className="flex size-8 shrink-0 items-center justify-center rounded-control text-accent hover:bg-fill focus-visible:focus-ring"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
        }
        toolbarEnd={
          <div className="ms-2 flex items-center gap-3">
            <span role="status" className="text-footnote text-label-secondary">
              {status === "saved"
                ? t("blocks.designSaved")
                : status === "saving"
                  ? t("blocks.saving")
                  : t("blocks.designUnsaved")}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => void save()}
                disabled={status === "saving" || status === "saved"}
                className="h-8 rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring disabled:opacity-50"
              >
                {t("blocks.designSave")}
              </button>
            )}
          </div>
        }
      />
      {problem && (
        <p
          role="alert"
          className="fixed bottom-4 left-1/2 z-40 max-w-xl -translate-x-1/2 rounded-card bg-surface-raised px-4 py-3 text-footnote text-danger shadow-float"
        >
          {t("blocks.designFailed", { message: problem })}
        </p>
      )}
      {imagePicker.dialog}
      {fonts.dialogs}
      <ConfirmDialog
        open={removal !== null}
        title={t("blocks.removalTitle")}
        message={t("blocks.removalMessage", {
          properties: removal?.properties.join(", ") ?? "",
          pages: removal?.pages.join(", ") ?? "",
        })}
        confirmLabel={t("blocks.removalConfirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setRemoval(null)}
        onConfirm={() => {
          setRemoval(null);
          void save(true);
        }}
      />
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

/** The design as the only thing on a page, so the builder can open it. */
function designAsPage(design: PageNode): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children: [design] } };
}

/**
 * The page back as one element: the design, or (when something was added beside it) a box
 * holding everything, since a block is always one element. Null when the page is empty.
 */
function designOf(document: PageDocument, name: string): PageNode | null {
  const [first, ...rest] = document.root.children;
  if (!first) return null;
  if (rest.length === 0) return first;
  return {
    id: createRandomNodeId(),
    type: "box",
    name,
    props: {},
    styles: { base: {} },
    children: document.root.children,
    hidden: false,
    locked: false,
  };
}
