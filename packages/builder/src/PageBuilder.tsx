import { defaultTheme, themeStylesheet } from "@lintel/site-components";
import {
  type Breakpoint,
  type CreateNodeId,
  createRandomNodeId,
  findNode,
  type PageDocument,
  sectionTemplates,
  starterSites as allStarterSites,
  type StarterSite,
} from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import type { Translate as MotionText } from "@lintel/motion-editor";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Canvas, type MotionPreview } from "./canvas/Canvas.js";
import type { CanvasSite } from "./canvas/canvas-frame-script.js";
import type { ForwardedKey, MessageFromFrame } from "./canvas/canvas-messages.js";
import { isLocked, layerName } from "./editor/commands.js";
import { isTypingTarget, shortcutFor } from "./editor/shortcuts.js";
import { useBuilder } from "./editor/useBuilder.js";
import { Breadcrumbs } from "./frame/Breadcrumbs.js";
import { EmptyPageStart } from "./frame/EmptyPageStart.js";
import { Toolbar } from "./frame/Toolbar.js";
import { englishText, type Translate, BuilderTextProvider } from "./i18n/builder-text.js";
import {
  browserPreferenceStore,
  type PreferenceStore,
  usePreference,
} from "./preferences/builder-preferences.js";
import type { ImagePicker } from "./panels/content-fields.js";
import { InsertPanel } from "./panels/InsertPanel.js";
import { LayersPanel } from "./panels/LayersPanel.js";
import { SelectedElementPanel } from "./panels/SelectedElementPanel.js";
import type { ComponentRegistry } from "./render/component-registry.js";
import { designBaseStylesheet } from "./render/design-stylesheet.js";
import { renderPage } from "./render/render-page.js";
import { standInBaseStylesheet } from "./render/base-stylesheet.js";
import { standardRegistry } from "./render/stand-in-components.js";
import { readSkillLevel, type SkillLevel, toolsFor } from "./skill-level/skill-levels.js";
import { GuidedTour } from "./tour/GuidedTour.js";
import { useTips } from "./tour/useTips.js";
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
  /**
   * The website around the page: its whole stylesheet, header, footer and the motion
   * runtime, so the canvas looks exactly like the published page and can play animations.
   * Without it the canvas uses `themeStylesheet` and `baseStylesheet`.
   */
  site?: CanvasSite;
  /** The app's words for the animation studio (`motionEditorStrings`); English when left out. */
  motionText?: MotionText;
  /** Whole pages an empty page can start from. The template library's by default. */
  starterSites?: readonly StarterSite[];
  /** Where skill level, the tour and closed tips are remembered. The browser's by default. */
  preferences?: PreferenceStore;
}

/** The site's default theme, until the app passes the site's own. */
const defaultThemeStylesheet = themeStylesheet(defaultTheme);

type LeftTab = "layers" | "insert";

/**
 * The visual page builder: Layers and Insert on the left, the page in the middle, Style,
 * Content and Animate (and, for developers, Code) on the right, with the toolbar on top.
 * The first time someone opens it, a short tour shows them around.
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
  const { state, selectedId, selectedNode, actions, announcement, announce } = useBuilder({
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
  const [startedBlank, setStartedBlank] = useState(false);
  const [motionPreview, setMotionPreview] = useState<MotionPreview | null>(null);
  const preferences = props.preferences ?? browserPreferenceStore;
  const [skillLevel, setSkillLevel] = usePreference<SkillLevel>(
    preferences,
    "skillLevel",
    (stored) => readSkillLevel(stored, canEditCode),
  );
  const [tourSeen, setTourSeen] = usePreference(preferences, "tourSeen", (stored) =>
    stored === "yes" ? "yes" : "no",
  );
  const [isTouring, setIsTouring] = useState(false);
  const tips = useTips(preferences);
  const tools = toolsFor(skillLevel, canEditCode);
  const { root } = state.document;
  const catalogue = registry.catalogue;

  const rendered = useMemo(
    () => renderPage(state.document, registry, { mode: "canvas" }),
    [state.document, registry],
  );
  const site = props.site;
  const canvasCss = useMemo(
    () =>
      site
        ? `${site.stylesheet}\n${rendered.css}`
        : `${props.themeStylesheet ?? defaultThemeStylesheet}\n${standInBaseStylesheet}\n${props.baseStylesheet ?? ""}\n${designBaseStylesheet}\n${rendered.css}`,
    [site, props.themeStylesheet, props.baseStylesheet, rendered.css],
  );

  const previewMotion = useCallback(
    (nodeId: string, spec: MotionSpec) =>
      setMotionPreview((current) => ({ nodeId, spec, playId: (current?.playId ?? 0) + 1 })),
    [],
  );

  const changeSkillLevel = useCallback(
    (level: SkillLevel) => {
      setSkillLevel(level);
      const name = text(`pageBuilder.skill.${level}`);
      announce(text("pageBuilder.skill.changed", { level: name }));
    },
    [setSkillLevel, announce, text],
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

  const showsTour = isTouring || (tourSeen === "no" && !showsStart);
  const closeTour = () => {
    setIsTouring(false);
    setTourSeen("yes");
  };

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
        canEditCode={canEditCode}
        skillLevel={skillLevel}
        onSkillLevelChange={changeSkillLevel}
        onReplayTour={() => {
          setStartedBlank(true);
          setIsTouring(true);
        }}
        onShowTips={tips.showAgain}
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
                canEditCode={tools.codeTools}
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
              starterSites={props.starterSites ?? allStarterSites}
              onChooseTemplate={(templateId) => actions.insert(`template:${templateId}`)}
              onChooseStarterPage={actions.useStarterPage}
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
              site={site}
              motionPreview={motionPreview}
              onMessage={handleFrameMessage}
            />
          )}
        </main>
        <SelectedElementPanel
          document={state.document}
          node={selectedNode ?? null}
          nodeName={labels.selected ?? ""}
          definition={definition}
          isLocked={selectedIsLocked}
          breakpoint={breakpoint}
          registry={registry}
          tools={tools}
          tips={tips}
          pickImage={props.pickImage}
          motionText={props.motionText}
          showCode={skillLevel === "developer"}
          actions={{
            ...actions,
            animate: (nodeId, animation) => {
              actions.animate(nodeId, animation);
              if (!animation) setMotionPreview(null);
            },
          }}
          onPreviewMotion={previewMotion}
        />
      </div>
      {showsTour && <GuidedTour onClose={closeTour} />}
      {/* The same sentence twice in a row is still read out: the space changes the text. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement.message}
        {announcement.count % 2 === 1 ? "\u00a0" : ""}
      </div>
    </div>
  );
}
