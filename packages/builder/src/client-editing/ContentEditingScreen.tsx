import {
  type Breakpoint,
  clientMayEditText,
  compileTagStyles,
  clientEditsOf,
  createRandomNodeId,
  designVariablesStylesheet,
  emptySiteDesign,
  findNode,
  hasOwnContent,
  hasSiteSection,
  isHiddenOnPage,
  listNodes,
  ownSiteChrome,
  type PageNode,
  sharedStylesById,
  siteSectionSlotOf,
  withoutTagStyles,
} from "@lintel/builder-model";
import { defaultTheme, themeStylesheet } from "@lintel/site-components";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { PageBuilderProps } from "../PageBuilder.js";
import { blocksByHandle, noBlocks } from "../blocks/blocks-context.js";
import { Canvas } from "../canvas/Canvas.js";
import type { MessageFromFrame } from "../canvas/canvas-messages.js";
import { layerName } from "../editor/commands.js";
import { isTypingTarget, shortcutFor } from "../editor/shortcuts.js";
import { useBuilder } from "../editor/useBuilder.js";
import { Toolbar } from "../frame/Toolbar.js";
import type { Translate } from "../i18n/builder-text.js";
import { canvasPageData } from "../panels/canvas-data.js";
import { DataSourcesContext, noDataSources } from "../panels/data-sources.js";
import { PictureBaseUrlContext } from "../panels/content-fields.js";
import {
  browserPreferenceStore,
  PreferenceStoreContext,
  usePreference,
} from "../preferences/builder-preferences.js";
import { standInBaseStylesheet } from "../render/base-stylesheet.js";
import { designBaseStylesheet } from "../render/design-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";
import { useSiteSections } from "../site-sections/useSiteSections.js";
import { GuidedTour } from "../tour/GuidedTour.js";
import { clientTourSteps } from "../tour/tour-steps.js";
import { useTips } from "../tour/useTips.js";
import { ClientContentPanel } from "./ClientContentPanel.js";

const defaultThemeStylesheet = themeStylesheet(defaultTheme);

/**
 * The page builder for people who may change content but not the design (clients): the
 * page as it looks, where they type into the words, replace pictures and change links their
 * designer opened up, and add or remove items where allowed. No Insert, Layers, Style,
 * Animate, site styles or code; nothing is dragged, and designed parts can't be deleted.
 * Undo and History work as usual. The server checks every save the same way (see
 * packages/core/src/client-editing).
 */
export function ContentEditingScreen(props: PageBuilderProps & { text: Translate }) {
  const { text, onSaveNow } = props;
  const registry = props.registry ?? standardRegistry;
  const catalogue = registry.catalogue;
  const blocks = props.blocks ?? noBlocks;
  // The site's navigation and footer show, but stay as they are.
  const siteSections = useMemo(
    () => (props.siteSections ? { value: props.siteSections.value } : undefined),
    [props.siteSections],
  );
  const shared = useSiteSections(siteSections, props.initialDocument, props.onChange);
  const { state, selectedId, selectedNode, actions, announcement, announce } = useBuilder({
    initialDocument: shared.initialDocument,
    registry,
    createId: props.createId ?? createRandomNodeId,
    canEditCode: false,
    text,
    onChange: shared.onChange,
    blocks: blocks.library,
  });
  const { root } = state.document;
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("base");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const preferences = props.preferences ?? browserPreferenceStore;
  const [tourSeen, setTourSeen] = usePreference(preferences, "clientTourSeen", (stored) =>
    stored === "yes" ? "yes" : "no",
  );
  const [isTouring, setIsTouring] = useState(false);
  const tips = useTips(preferences);

  // What's in the site's navigation and footer is the site's, not the page's.
  const sharedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const child of root.children) {
      if (siteSectionSlotOf(child.id)) listNodes(child).forEach((node) => ids.add(node.id));
    }
    return ids;
  }, [root]);
  const mayEditText = useCallback(
    (node: PageNode, prop: string) =>
      !sharedIds.has(node.id) && clientMayEditText(node, catalogue.find(node.type), prop),
    [sharedIds, catalogue],
  );

  const dataSources = props.dataSources ?? noDataSources;
  const siteDesign = props.siteDesign?.value ?? emptySiteDesign;
  const site = props.site;
  const rendered = useMemo(
    () =>
      renderPage(state.document, registry, {
        mode: "canvas",
        mayEditText,
        data: {
          ...canvasPageData(state.document, dataSources, site),
          blocks: blocksByHandle(blocks.library),
          pictures: blocks.pictures,
          renderedBlocks: blocks.renderedBlocks,
          sharedStyles: sharedStylesById(siteDesign),
          tagStyles: siteDesign.tagStyles,
        },
      }),
    [state.document, registry, mayEditText, dataSources, site, blocks, siteDesign],
  );
  const canvasCss = useMemo(() => {
    const own = ownSiteChrome(root);
    const hidesHeader =
      own.header || hasSiteSection(root, "navigation") || isHiddenOnPage(root, "navigation");
    const hidesFooter =
      own.footer || hasSiteSection(root, "footer") || isHiddenOnPage(root, "footer");
    const tagStyles = compileTagStyles(siteDesign.tagStyles);
    const variables = designVariablesStylesheet(siteDesign.variables);
    return [
      site
        ? `${withoutTagStyles(site.stylesheet)}\n${tagStyles}\n${rendered.css}`
        : `${props.themeStylesheet ?? defaultThemeStylesheet}\n${standInBaseStylesheet}\n${props.baseStylesheet ?? ""}\n${designBaseStylesheet}\n${tagStyles}\n${rendered.css}`,
      hidesHeader ? '[data-lintel-site-chrome="header"]{display:none}' : "",
      hidesFooter ? '[data-lintel-site-chrome="footer"]{display:none}' : "",
      variables,
    ]
      .filter(Boolean)
      .join("\n");
  }, [root, site, rendered.css, siteDesign, props.themeStylesheet, props.baseStylesheet]);

  const name = useCallback(
    (nodeId: string | null) => {
      const node = nodeId ? findNode(root, nodeId) : undefined;
      return node ? layerName(node, catalogue) : null;
    },
    [root, catalogue],
  );
  const labels = useMemo(
    () => ({ selected: name(selectedId), hovered: name(hoveredId) }),
    [name, selectedId, hoveredId],
  );

  const runShortcut = useCallback(
    (key: Parameters<typeof shortcutFor>[0]) => {
      const command = shortcutFor(key);
      if (command === "undo") actions.undo();
      else if (command === "redo") actions.redo();
      else if (command === "save") onSaveNow?.();
      else return false;
      return true;
    },
    [actions, onSaveNow],
  );

  const pickImage = props.pickImage;
  const replacePicture = useCallback(
    async (node: PageNode) => {
      if (!pickImage) return;
      const label = text("pageBuilder.clientView.replacePicture");
      const picked = await pickImage({
        label,
        currentAssetId: (node.props.assetId as string | null) ?? null,
      });
      if (picked) {
        actions.changeProps(
          node.id,
          { src: picked.src, assetId: picked.assetId, alt: picked.alt || node.props.alt || "" },
          label,
        );
        announce(label);
      }
    },
    [pickImage, actions, text, announce],
  );

  const handleFrameMessage = useCallback(
    (message: MessageFromFrame) => {
      if (message.type === "select") {
        actions.select(message.nodeId);
        // Clicking a picture the client may change opens the media library straight away.
        const node = message.nodeId ? findNode(root, message.nodeId) : undefined;
        if (
          node?.type === "image" &&
          !sharedIds.has(node.id) &&
          !node.bindings?.src &&
          clientEditsOf(node, catalogue.find(node.type)).has("pictures")
        ) {
          void replacePicture(node);
        }
      }
      if (message.type === "hover") setHoveredId(message.nodeId);
      if (message.type === "editText") {
        const node = findNode(root, message.nodeId);
        if (node && mayEditText(node, message.prop)) {
          actions.editText(message.nodeId, message.prop, message.text);
        }
      }
      if (message.type === "key") runShortcut(message.key);
    },
    [actions, root, sharedIds, catalogue, mayEditText, replacePicture, runShortcut],
  );

  useEffect(() => {
    function handleStrayKeyDown(event: globalThis.KeyboardEvent) {
      if (event.target === document.body && runShortcut(event)) event.preventDefault();
    }
    document.addEventListener("keydown", handleStrayKeyDown);
    return () => document.removeEventListener("keydown", handleStrayKeyDown);
  }, [runShortcut]);

  function handleKeyDown(event: KeyboardEvent) {
    if (isTypingTarget(event.target) && shortcutFor(event) !== "save") return;
    if (runShortcut(event)) event.preventDefault();
  }

  const showsTour = isTouring || tourSeen === "no";
  const hasContent = hasOwnContent(root);

  return (
    <PreferenceStoreContext.Provider value={preferences}>
      <DataSourcesContext.Provider value={dataSources}>
        <div className="flex h-dvh flex-col bg-background text-label" onKeyDown={handleKeyDown}>
          <Toolbar
            title={props.title}
            titleNote={props.toolbarTitleNote}
            afterTitle={props.toolbarAfterTitle}
            start={
              <>
                {props.toolbarStart}
                <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-caption font-medium text-label-secondary">
                  {text("pageBuilder.clientView.badge")}
                </span>
              </>
            }
            end={props.toolbarEnd}
            breakpoint={breakpoint}
            onBreakpointChange={setBreakpoint}
            undoLabel={state.past.at(-1)?.label}
            redoLabel={state.future.at(-1)?.label}
            onUndo={actions.undo}
            onRedo={actions.redo}
            history={[
              ...state.past.map((step) => step.label),
              ...state.future.map((step) => step.label).reverse(),
            ]}
            historyPosition={state.past.length}
            onGoToStep={actions.goToStep}
            onReplayTour={() => setIsTouring(true)}
            onShowTips={tips.showAgain}
          />
          <div className="flex min-h-0 flex-1">
            <main
              className="relative flex min-w-0 flex-1 flex-col"
              aria-label={text("pageBuilder.canvas.regionLabel")}
            >
              {hasContent ? (
                <Canvas
                  finishEditingRef={props.finishEditingRef}
                  html={rendered.html}
                  css={canvasCss}
                  breakpoint={breakpoint}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  labels={labels}
                  revealId={null}
                  canTransform={false}
                  canMove={false}
                  site={site}
                  scripts={props.frameScripts}
                  onMessage={handleFrameMessage}
                />
              ) : (
                <p className="m-auto max-w-sm p-8 text-center text-body text-label-secondary">
                  {text("pageBuilder.clientView.emptyPage")}
                </p>
              )}
            </main>
            <PictureBaseUrlContext value={site?.baseUrl ?? null}>
              <ClientContentPanel
                root={root}
                node={selectedNode && !sharedIds.has(selectedNode.id) ? selectedNode : null}
                nodeName={labels.selected ?? ""}
                catalogue={catalogue}
                pickImage={props.pickImage}
                onChangeProps={actions.changeProps}
                onReplacePicture={(node) => void replacePicture(node)}
                onAddAnother={(item) => {
                  if (actions.duplicateById(item.id)) {
                    announce(
                      text("pageBuilder.clientView.added", { name: layerName(item, catalogue) }),
                    );
                  }
                }}
                onRemove={(item) => {
                  if (actions.removeById(item.id)) {
                    announce(
                      text("pageBuilder.clientView.removed", { name: layerName(item, catalogue) }),
                    );
                  }
                }}
              />
            </PictureBaseUrlContext>
          </div>
          {showsTour && (
            <GuidedTour
              steps={clientTourSteps}
              fallbackFocusId="lintel-client-panel-heading"
              onClose={() => {
                setIsTouring(false);
                setTourSeen("yes");
              }}
            />
          )}
          <div role="status" aria-live="polite" className="sr-only">
            {announcement.message}
            {announcement.count % 2 === 1 ? " " : ""}
          </div>
        </div>
      </DataSourcesContext.Provider>
    </PreferenceStoreContext.Provider>
  );
}
