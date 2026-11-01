import { defaultTheme, themeStylesheet } from "@lintel/site-components";
import {
  type Breakpoint,
  type CreateNodeId,
  createRandomNodeId,
  findNode,
  type PageDocument,
  sectionTemplates,
} from "@lintel/builder-model";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Canvas } from "./canvas/Canvas.js";
import type { ForwardedKey, MessageFromFrame } from "./canvas/canvas-messages.js";
import { CodePanel } from "./developer/CodePanel.js";
import { isLocked, layerName } from "./editor/commands.js";
import { isTypingTarget, shortcutFor } from "./editor/shortcuts.js";
import { useBuilder } from "./editor/useBuilder.js";
import { Breadcrumbs } from "./frame/Breadcrumbs.js";
import { EmptyPageStart } from "./frame/EmptyPageStart.js";
import { Toolbar } from "./frame/Toolbar.js";
import { englishText, type Translate, BuilderTextProvider } from "./i18n/builder-text.js";
import type { ImagePicker } from "./panels/content-fields.js";
import { ContentPanel } from "./panels/ContentPanel.js";
import { InsertPanel } from "./panels/InsertPanel.js";
import { LayersPanel } from "./panels/LayersPanel.js";
import type { ComponentRegistry } from "./render/component-registry.js";
import { renderPage } from "./render/render-page.js";
import { standInBaseStylesheet } from "./render/base-stylesheet.js";
import { standardRegistry } from "./render/stand-in-components.js";
import { type StateChoice, StylePanel, type StylePanelMode } from "./style-panel/StylePanel.js";
import { Tabs } from "./ui/controls.js";

export interface PageBuilderProps {
  /** The page as stored. Read once; the builder owns it from then on. */
  initialDocument: PageDocument;
  /** Called with each new version of the page, for the app to save. */
  onChange: (document: PageDocument) => void;
  /** The page's name, shown in the toolbar as the screen's heading. */
  title: string;
  /** Has the `builder:code` permission: Developer mode and code blocks are available. */
  canEditCode: boolean;
  registry?: ComponentRegistry;
  /** The site's theme tokens (`themeStylesheet` from site-components); defaults to the default theme. */
  themeStylesheet?: string;
  /**
   * The site's component styles (`@lintel/site-components/styles.css`), drawn after the
   * builder's own element defaults. Without them, the site's blocks are unstyled.
   */
  baseStylesheet?: string;
  pickImage?: ImagePicker;
  /** The admin's `t()`, so the builder's words can be translated with the admin's. */
  text?: Translate;
  /** Before the title: usually a back link. After the toolbar's controls: save state, Publish. */
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  onSaveNow?: () => void;
  createId?: CreateNodeId;
}

/** The site's default theme, until the app passes the site's own. */
const defaultThemeStylesheet = themeStylesheet(defaultTheme);

type LeftTab = "layers" | "insert";
type RightTab = "style" | "content" | "code";

/**
 * The visual page builder: Layers and Insert on the left, the page in the middle, Style and
 * Content (and, in Developer mode, Code) on the right, with the toolbar on top.
 */
export function PageBuilder({ text = englishText, ...props }: PageBuilderProps) {
  return (
    <BuilderTextProvider text={text}>
      <PageBuilderScreen {...props} text={text} />
    </BuilderTextProvider>
  );
}

function PageBuilderScreen(props: PageBuilderProps & { text: Translate }) {
  const { text, canEditCode, onSaveNow } = props;
  const registry = props.registry ?? standardRegistry;
  const createId = props.createId ?? createRandomNodeId;
  const { state, selectedId, selectedNode, actions, announcement } = useBuilder({
    initialDocument: props.initialDocument,
    registry,
    createId,
    canEditCode,
    text,
    onChange: props.onChange,
  });
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("base");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [rightTab, setRightTab] = useState<RightTab>("style");
  const [styleMode, setStyleMode] = useState<StylePanelMode>("simple");
  const [styleState, setStyleState] = useState<StateChoice>("none");
  const [developerMode, setDeveloperMode] = useState(false);
  const [startedBlank, setStartedBlank] = useState(false);
  const { root } = state.document;
  const catalogue = registry.catalogue;
  const showsDeveloperTools = canEditCode && developerMode;
  const activeRightTab = rightTab === "code" && !showsDeveloperTools ? "style" : rightTab;

  const rendered = useMemo(
    () => renderPage(state.document, registry, { mode: "canvas" }),
    [state.document, registry],
  );
  const canvasCss = useMemo(
    () =>
      `${props.themeStylesheet ?? defaultThemeStylesheet}\n${standInBaseStylesheet}\n${props.baseStylesheet ?? ""}\n${rendered.css}`,
    [props.themeStylesheet, props.baseStylesheet, rendered.css],
  );

  const selectFromPanel = useCallback(
    (nodeId: string | null) => {
      actions.select(nodeId);
      setRevealId(nodeId);
    },
    [actions],
  );

  const runShortcut = useCallback(
    (key: ForwardedKey) => {
      const command = shortcutFor(key);
      if (!command) return false;
      const selected = state.selectedId;
      switch (command) {
        case "undo":
          actions.undo();
          break;
        case "redo":
          actions.redo();
          break;
        case "copy":
          actions.copy();
          break;
        case "cut":
          actions.cut();
          break;
        case "duplicate":
          actions.duplicate();
          break;
        case "remove":
          actions.remove();
          break;
        case "save":
          onSaveNow?.();
          break;
        case "selectParent":
          actions.selectParent();
          break;
        case "moveUp":
        case "moveDown":
        case "moveIn":
        case "moveOut":
          actions.move(
            ({ moveUp: "up", moveDown: "down", moveIn: "in", moveOut: "out" } as const)[command],
          );
          break;
        case "toggleHidden":
          if (selected) actions.toggleHidden(selected);
          break;
        case "toggleLocked":
          if (selected) actions.toggleLocked(selected);
          break;
        case "selectPrevious":
          actions.selectAdjacent(-1);
          break;
        case "selectNext":
          actions.selectAdjacent(1);
          break;
      }
      return true;
    },
    [actions, state.selectedId, onSaveNow],
  );

  const handleFrameMessage = useCallback(
    (message: MessageFromFrame) => {
      if (message.type === "select") actions.select(message.nodeId);
      if (message.type === "hover") setHoveredId(message.nodeId);
      if (message.type === "editText") actions.editText(message.nodeId, message.prop, message.text);
      if (message.type === "key") runShortcut(message.key);
      if (message.type === "paste") actions.paste(message);
    },
    [actions, runShortcut],
  );

  // Pasting while the builder (not a text box) has focus imports what's on the clipboard.
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      actions.paste({
        html: event.clipboardData?.getData("text/html") ?? "",
        text: event.clipboardData?.getData("text/plain") ?? "",
      });
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [actions]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isTypingTarget(event.target)) {
      const key = event.key.toLowerCase();
      // Undo inside a text box belongs to the text box, except for the builder's own save.
      if (!((event.metaKey || event.ctrlKey) && key === "s")) return;
    }
    const isArrowSelect = !event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown");
    // Arrow keys belong to whatever has focus (the Layers tree, a radio group...); the canvas
    // forwards its own. Escape inside a popover closes the popover.
    if (
      isArrowSelect ||
      (event.key === "Escape" && (event.target as HTMLElement).closest("[role='dialog']"))
    )
      return;
    // Delete and Escape act on the selection only from the Layers tree, so pressing them on a
    // button or a panel never removes something by surprise.
    const command = shortcutFor(event);
    const fromTree = (event.target as HTMLElement).closest("[role='tree']") !== null;
    if ((command === "remove" || command === "selectParent") && !fromTree) return;
    if (runShortcut(event)) event.preventDefault();
  }

  const definition = selectedNode ? catalogue.find(selectedNode.type) : undefined;
  const selectedIsLocked = selectedNode ? isLocked(state.document, selectedNode.id) : false;
  const showsStart = root.children.length === 0 && !startedBlank;
  const labels = useMemo(() => {
    const nameOf = (nodeId: string | null) => {
      const node = nodeId ? findNode(state.document.root, nodeId) : undefined;
      return node ? layerName(node, catalogue) : null;
    };
    return { selected: nameOf(selectedId), hovered: nameOf(hoveredId) };
  }, [state.document, selectedId, hoveredId, catalogue]);

  const rightTabs: Array<{ value: RightTab; label: string }> = [
    { value: "style", label: text("pageBuilder.panels.style") },
    { value: "content", label: text("pageBuilder.panels.content") },
    ...(showsDeveloperTools
      ? [{ value: "code" as const, label: text("pageBuilder.panels.code") }]
      : []),
  ];

  return (
    <div className="flex h-dvh flex-col bg-background text-label" onKeyDown={handleKeyDown}>
      <Toolbar
        title={props.title}
        start={props.toolbarStart}
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
        canUseDeveloperMode={canEditCode}
        developerMode={developerMode}
        onDeveloperModeChange={(on) => {
          setDeveloperMode(on);
          if (on) setRightTab("code");
        }}
      />
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label={text("pageBuilder.panels.leftLabel")}
          className="flex w-72 shrink-0 flex-col border-r border-separator bg-surface"
        >
          <Tabs<LeftTab>
            label={text("pageBuilder.panels.leftLabel")}
            idPrefix="lintel-left"
            value={leftTab}
            onChange={setLeftTab}
            tabs={[
              { value: "layers", label: text("pageBuilder.panels.layers") },
              { value: "insert", label: text("pageBuilder.panels.insert") },
            ]}
          />
          <div
            id="lintel-left-panel"
            role="tabpanel"
            aria-labelledby={`lintel-left-tab-${leftTab}`}
            className="min-h-0 flex-1 overflow-auto"
          >
            {leftTab === "layers" ? (
              <LayersPanel
                root={root}
                catalogue={catalogue}
                selectedId={selectedId}
                onSelect={selectFromPanel}
                onHover={setHoveredId}
                onToggleHidden={actions.toggleHidden}
                onToggleLocked={actions.toggleLocked}
                onRename={actions.rename}
                onMove={actions.moveTo}
                onInsertAt={(key, parentId, index) =>
                  actions.insert(key as `component:${string}`, { parentId, index })
                }
              />
            ) : (
              <InsertPanel
                catalogue={catalogue}
                templates={sectionTemplates}
                canEditCode={canEditCode}
                onInsert={(key) => actions.insert(key)}
              />
            )}
          </div>
        </aside>
        <main
          className="flex min-w-0 flex-1 flex-col"
          aria-label={text("pageBuilder.canvas.regionLabel")}
        >
          <Breadcrumbs
            root={root}
            catalogue={catalogue}
            selectedId={selectedId}
            onSelect={selectFromPanel}
          />
          {showsStart ? (
            <EmptyPageStart
              templates={sectionTemplates}
              onChooseTemplate={(templateId) => actions.insert(`template:${templateId}`)}
              onStartBlank={() => {
                setStartedBlank(true);
                setLeftTab("insert");
              }}
            />
          ) : (
            <Canvas
              html={rendered.html}
              css={canvasCss}
              breakpoint={breakpoint}
              selectedId={selectedId}
              hoveredId={hoveredId}
              labels={labels}
              revealId={revealId}
              onMessage={handleFrameMessage}
            />
          )}
        </main>
        <aside
          aria-label={text("pageBuilder.panels.rightLabel")}
          className="flex w-80 shrink-0 flex-col border-l border-separator bg-surface"
        >
          <Tabs<RightTab>
            label={text("pageBuilder.panels.rightLabel")}
            idPrefix="lintel-right"
            value={activeRightTab}
            onChange={setRightTab}
            tabs={rightTabs}
          />
          <div
            id="lintel-right-panel"
            role="tabpanel"
            aria-labelledby={`lintel-right-tab-${activeRightTab}`}
            className="min-h-0 flex-1 overflow-auto"
          >
            {activeRightTab === "code" ? (
              <CodePanel
                document={state.document}
                node={selectedNode ?? null}
                registry={registry}
                isLocked={selectedIsLocked}
                onApplyHtml={actions.applyHtml}
                onConvertToCode={actions.convertToCode}
                onChangeCode={actions.changeCode}
                onPasteHtml={actions.pasteHtml}
              />
            ) : !selectedNode ? (
              <p className="px-4 py-6 text-footnote text-label-secondary">
                {text("pageBuilder.panels.selectSomething")}
              </p>
            ) : activeRightTab === "style" ? (
              <StylePanel
                node={selectedNode}
                definition={definition}
                breakpoint={breakpoint}
                mode={styleMode}
                onModeChange={setStyleMode}
                state={styleState}
                onStateChange={setStyleState}
                isLocked={selectedIsLocked}
                onChange={(target, values, label) =>
                  actions.changeStyles(selectedNode.id, target, values, label)
                }
              />
            ) : (
              <ContentPanel
                node={selectedNode}
                definition={definition}
                isLocked={selectedIsLocked}
                pickImage={props.pickImage}
                onChange={(changed, label) => actions.changeProps(selectedNode.id, changed, label)}
              />
            )}
          </div>
        </aside>
      </div>
      {/* The same sentence twice in a row is still read out: the space changes the text. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement.message}
        {announcement.count % 2 === 1 ? "\u00a0" : ""}
      </div>
    </div>
  );
}
