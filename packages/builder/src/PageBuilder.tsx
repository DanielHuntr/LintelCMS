import { defaultTheme, themeStylesheet } from "@lintel/site-components";
import {
  type PageFinder,
  PageFinderContext,
  type PagePicker,
  PagePickerContext,
} from "./panels/page-picker.js";
import {
  type Breakpoint,
  type CreateNodeId,
  createRandomNodeId,
  designVariablesStylesheet,
  emptySiteDesign,
  sharedStylesById,
  compileTagStyles,
  withoutTagStyles,
  type SiteDesign,
  type SiteDesignUses,
  findNode,
  ownSiteChrome,
  assignClassNames,
  compileStatePreview,
  type StyleTarget,
  type PageDocument,
  sectionTemplates,
  sectionsFromDraftPlan,
  starterSites as allStarterSites,
  type StarterSite,
  hasOwnContent,
  hasSiteSection,
  isHiddenOnPage,
  siteSectionSlotOf,
  type SiteSectionSlot,
  unmarkedOwnNavigation,
} from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import { type Translate as MotionText } from "@lintel/motion-editor";
import {
  cursorIsOn,
  effectRegistry,
  measurePageWeight,
  type SiteEffectSettings,
} from "@lintel/motion/effects";
import type { EffectPreview } from "./animate-panel/AnimatePanel.js";
import { collectNodeEffects } from "./render/page-effects.js";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type BlockMaster,
  BlocksProvider,
  type BuilderBlocks,
  blocksByHandle,
  noBlocks,
} from "./blocks/blocks-context.js";
import { Canvas, type MotionPreview } from "./canvas/Canvas.js";
import { canvasDropTarget, type CanvasDropTarget } from "./canvas/canvas-drop.js";
import type { CanvasScriptAddresses, CanvasSite } from "./canvas/canvas-frame-script.js";
import {
  SiteFontsContext,
  type SiteFontTools,
  type UploadedPageFont,
} from "./style-panel/font-choices.js";
import type {
  ForwardedKey,
  MessageFromFrame,
  TextSelectionMessage,
} from "./canvas/canvas-messages.js";
import { isLocked, layerName } from "./editor/commands.js";
import { isTextEntry, isTypingTarget, shortcutFor } from "./editor/shortcuts.js";
import { useBuilder } from "./editor/useBuilder.js";
import { Breadcrumbs } from "./frame/Breadcrumbs.js";
import { EmptyPage } from "./frame/EmptyPage.js";
import { Toolbar } from "./frame/Toolbar.js";
import { englishText, type Translate, BuilderTextProvider } from "./i18n/builder-text.js";
import {
  browserPreferenceStore,
  PreferenceStoreContext,
  type PreferenceStore,
  usePreference,
} from "./preferences/builder-preferences.js";
import { type ImagePicker, PictureBaseUrlContext } from "./panels/content-fields.js";
import { PictureDropStatus } from "./canvas/PictureDropStatus.js";
import { type PictureUploader, usePictureDrop } from "./canvas/usePictureDrop.js";
import { canvasPageData } from "./panels/canvas-data.js";
import { MenuEditingContext, type RenderMenuEditor } from "./menus/menu-editing.js";
import type { PickedMenuItem } from "./menus/menu-link-panel.js";
import {
  type BuilderDataSources,
  DataSourcesContext,
  noDataSources,
} from "./panels/data-sources.js";
import { type InsertFocusRequest, InsertPanel } from "./panels/InsertPanel.js";
import type { InsertItem } from "./panels/insert-library.js";
import { LayersPanel } from "./panels/LayersPanel.js";
import { SelectedElementPanel } from "./panels/SelectedElementPanel.js";
import { type CanvasLook, CanvasLookContext } from "./style-panel/canvas-look.js";
import type { ComponentRegistry } from "./render/component-registry.js";
import { designBaseStylesheet } from "./render/design-stylesheet.js";
import { renderPage } from "./render/render-page.js";
import { standInBaseStylesheet } from "./render/base-stylesheet.js";
import { standardRegistry } from "./render/stand-in-components.js";
import { selectedWords, SelectedWordsBar } from "./inline-text/SelectedWordsBar.js";
import { toggleChange } from "./inline-text/markToggles.js";
import type { FileUploader } from "./style-panel/design-tools.js";
import { SiteDesignContext } from "./site-design/site-design-context.js";
import { themeTokenValues } from "./site-design/theme-token-values.js";
import { SiteMotionSettingsWithColours } from "./animate-panel/SiteMotionSettingsWithColours.js";
import { GuidedTour } from "./tour/GuidedTour.js";
import { useTips } from "./tour/useTips.js";
import { Tabs } from "./ui/controls.js";
import {
  PageSiteSections,
  SectionSiteTools,
  SiteSectionNote,
  SiteSectionRemoveDialog,
  SiteSectionStrip,
  siteSectionAround,
} from "./site-sections/SiteSectionControls.js";
import { type SiteSectionsSource, useSiteSections } from "./site-sections/useSiteSections.js";
import { DraftPageButton } from "./page-drafts/DraftPageButton.js";
import { type PageDrafting, PageDraftingContext } from "./page-drafts/page-drafting.js";
import { ContentEditingScreen } from "./client-editing/ContentEditingScreen.js";

export interface PageBuilderProps {
  /** The page as stored. Read once; the builder owns it from then on. */
  initialDocument: PageDocument;
  /** Called with each new version of the page, for the app to save. */
  onChange: (document: PageDocument) => void;
  /** The page's name, shown in the toolbar as the screen's heading. */
  title: string;
  /** Has the `builder:code` permission: Code elements can be added and their code edited. */
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
  /**
   * Uploads a picture dropped on, or pasted into, a Picture element on the canvas. Without
   * it, dropped and pasted files are ignored.
   */
  uploadPicture?: PictureUploader;
  /** Finds a page of the site for a link ("Choose a page…" beside link inputs). */
  pickPage?: PagePicker;
  /** Finds a linked page's title by its id, so links to pages show "About", not a reference. */
  findPage?: PageFinder;
  /** Uploads a font or video file to the media library, for custom fonts and video backgrounds. */
  uploadFile?: FileUploader;
  /** Opens the site's fonts, from "Add a font". Left out, the button isn't shown. */
  onAddFont?: () => void;
  /** Makes a font uploaded to this page alone a site font; resolves true when it did. */
  onMoveFontToSite?: (font: UploadedPageFont) => Promise<boolean>;
  /** The admin's `t()`, so the builder's words can be translated with the admin's. */
  text?: Translate;
  /** Before the title: usually a back link. After the toolbar's controls: save state, Publish. */
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  /** Under the page's name in the toolbar, and after it. */
  toolbarTitleNote?: ReactNode;
  toolbarAfterTitle?: ReactNode;
  onSaveNow?: () => void;
  createId?: CreateNodeId;
  /**
   * The website around the page: its whole stylesheet, header, footer and the motion
   * runtime, so the canvas looks exactly like the published page and can play animations.
   * Without it the canvas uses `themeStylesheet` and `baseStylesheet`.
   */
  site?: CanvasSite;
  /**
   * Where the canvas frame's scripts are served, for hosts whose Content-Security-Policy
   * refuses inline scripts (see `canvasFrameScript`). Inline when left out.
   */
  frameScripts?: CanvasScriptAddresses;
  /** The app's words for the animation studio (`motionEditorStrings`); English when left out. */
  motionText?: MotionText;
  /**
   * Where each effect module (`@lintel/motion/effect-modules`) is served, so effects can be
   * tried on the canvas and in the gallery. Without it, effects are still added, not previewed.
   */
  effectModules?: Readonly<Record<string, string>>;
  /** The site-wide motion settings (page transitions, cursor, intro), and how to save them. */
  siteEffects?: { value: SiteEffectSettings; onChange: (value: SiteEffectSettings) => void };
  /** Whole pages an empty page can start from. The template library's by default. */
  starterSites?: readonly StarterSite[];
  /** Where the tour and closed tips are remembered. The browser's by default. */
  preferences?: PreferenceStore;
  /** The site's collections, forms and products, for collection lists and shop elements. */
  dataSources?: BuilderDataSources;
  /** The plugins switched on: the shop's and forms' elements are only offered with theirs. */
  enabledPlugins?: readonly string[];
  /**
   * The app's menu editor, shown in the Content tab when someone presses "Edit menu" on a
   * Header, Menu or Menu drawer (or "Add pages to your menu" on the canvas). Without it,
   * the panel says where menus are edited.
   */
  menuEditor?: RenderMenuEditor;
  /**
   * The site's own blocks: offered in Insert, drawn on the canvas, made from a selection
   * ("Make into a block") and filled in from the right-hand panel.
   */
  blocks?: BuilderBlocks;
  /** Set while editing a block's design: elements are bound to its properties. */
  blockMaster?: BlockMaster;
  /**
   * The site's design variables and shared styles, and how to save a change to them (left
   * out for people who may only use them). Without it, the site has none.
   */
  siteDesign?: {
    value: SiteDesign;
    onChange?: (value: SiteDesign) => void;
    /** Where they're used on the rest of the site, for "12 uses" (see SiteDesignTools). */
    uses?: SiteDesignUses;
  };
  /**
   * The site's navigation and footer, shown on every page and edited from any of them (see
   * site-sections/). Without it, Navigation and Footer sections belong to the page alone.
   */
  siteSections?: SiteSectionsSource;
  /**
   * Page drafting from the app (see page-drafts/): "Draft a page for me" and "Rewrite this".
   * Left out, neither is shown.
   */
  pageDrafting?: PageDrafting;
  /** Told which element is selected (null for none), such as for trying another version of it. */
  onSelectionChange?: (nodeId: string | null) => void;
  /**
   * For people who may change content but not the design (clients): the page opens in
   * "Edit content", where only the words, pictures and links the designer opened up change.
   */
  contentOnly?: boolean;
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
  const { site, onAddFont, onMoveFontToSite } = props;
  const siteFonts = useMemo<SiteFontTools>(
    () => ({ fonts: site?.fonts ?? [], addFont: onAddFont, moveToSite: onMoveFontToSite }),
    [site?.fonts, onAddFont, onMoveFontToSite],
  );
  return (
    <BuilderTextProvider text={text}>
      <PagePickerContext value={props.pickPage}>
        <PageFinderContext value={props.findPage}>
          <SiteFontsContext value={siteFonts}>
            <PageDraftingContext value={props.pageDrafting}>
              {props.contentOnly ? (
                <ContentEditingScreen {...props} text={text} />
              ) : (
                <PageBuilderScreen {...props} text={text} />
              )}
            </PageDraftingContext>
          </SiteFontsContext>
        </PageFinderContext>
      </PagePickerContext>
    </BuilderTextProvider>
  );
}

function PageBuilderScreen(props: PageBuilderProps & { text: Translate }) {
  const { text, canEditCode, onSaveNow } = props;
  const registry = props.registry ?? standardRegistry;
  const createId = props.createId ?? createRandomNodeId;
  const blocks = props.blocks ?? noBlocks;
  const sharedSections = useSiteSections(props.siteSections, props.initialDocument, props.onChange);
  const { state, selectedId, selectedNode, actions, announcement, announce } = useBuilder({
    initialDocument: sharedSections.initialDocument,
    registry,
    createId,
    canEditCode,
    text,
    onChange: sharedSections.onChange,
    blocks: blocks.library,
    sharesSiteSections: props.siteSections?.onChange !== undefined,
  });
  const { onSelectionChange } = props;
  useEffect(() => onSelectionChange?.(selectedId), [onSelectionChange, selectedId]);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("base");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // The menu link clicked on the canvas, for "Changes apply to: Only Contact".
  const [pickedMenuItem, setPickedMenuItem] = useState<PickedMenuItem | null>(null);
  // "Select them" in Site styles: the elements outlined together, while one of them is selected.
  const [highlight, setHighlight] = useState<readonly string[]>([]);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [insertFocusRequest, setInsertFocusRequest] = useState<InsertFocusRequest>();
  const [motionPreview, setMotionPreview] = useState<MotionPreview | null>(null);
  const [textSelection, setTextSelection] = useState<TextSelectionMessage | null>(null);
  // How the selected element looks on the canvas, for the style panel's "as it is now".
  const [canvasLook, setCanvasLook] = useState<CanvasLook | null>(null);
  // Mod+K asks the selected words' bar for a link; the bar watches this go up.
  const [linkRequest, setLinkRequest] = useState(0);
  const preferences = props.preferences ?? browserPreferenceStore;
  const [tourSeen, setTourSeen] = usePreference(preferences, "tourSeen", (stored) =>
    stored === "yes" ? "yes" : "no",
  );
  const [isTouring, setIsTouring] = useState(false);
  const [editingMenuFor, setEditingMenuFor] = useState<string | null>(null);
  const tips = useTips(preferences);
  // Drafted sections go on the page as one change; people are asked to check the words.
  const draftButton = (look: "link" | "row") => (
    <DraftPageButton
      look={look}
      onMessage={announce}
      onDrafted={(plan) => {
        const count = plan.sections.length;
        if (
          actions.insertDraftedSections(
            sectionsFromDraftPlan(plan),
            text("pageBuilder.draft.history", { count }),
          )
        ) {
          announce(text("pageBuilder.draft.added", { count }));
        }
      }}
    />
  );
  const pictures = usePictureDrop({
    root: state.document.root,
    uploadPicture: props.uploadPicture,
    changeProps: actions.changeProps,
    select: actions.select,
    announce,
    text,
  });
  const { root } = state.document;
  const catalogue = registry.catalogue;

  const dataSources = props.dataSources ?? noDataSources;
  const blockData = useMemo(
    () => ({
      blocks: blocksByHandle(blocks.library),
      pictures: blocks.pictures,
      renderedBlocks: blocks.renderedBlocks,
    }),
    [blocks.library, blocks.pictures, blocks.renderedBlocks],
  );
  const siteDesign = props.siteDesign?.value ?? emptySiteDesign;
  const themeValues = useMemo(
    () =>
      themeTokenValues(props.site?.stylesheet ?? props.themeStylesheet ?? defaultThemeStylesheet),
    [props.site?.stylesheet, props.themeStylesheet],
  );
  const siteDesignTools = useMemo(
    () => ({
      design: siteDesign,
      change: props.siteDesign?.onChange,
      themeValues,
      uses: props.siteDesign?.uses,
    }),
    [siteDesign, props.siteDesign?.onChange, themeValues, props.siteDesign?.uses],
  );
  const sharedStyles = useMemo(() => sharedStylesById(siteDesign), [siteDesign]);
  const rendered = useMemo(
    () =>
      renderPage(state.document, registry, {
        mode: "canvas",
        data: {
          ...canvasPageData(state.document, dataSources, props.site),
          ...blockData,
          sharedStyles,
          tagStyles: siteDesign.tagStyles,
        },
      }),
    [
      state.document,
      registry,
      dataSources,
      props.site,
      blockData,
      sharedStyles,
      siteDesign.tagStyles,
    ],
  );
  // The site's variables, drawn after its stylesheet so changes show before they're saved.
  const variablesCss = useMemo(
    () => designVariablesStylesheet(siteDesign.variables),
    [siteDesign.variables],
  );
  // The site's looks for every heading, link and so on, drawn in place of the saved ones in
  // the site's stylesheet (and before the page's own rules), so changes show at once.
  const tagStylesCss = useMemo(
    () => compileTagStyles(siteDesign.tagStyles),
    [siteDesign.tagStyles],
  );
  const menuChoices = useMemo(
    () => (dataSources.menus ?? []).map((menu) => ({ value: menu.handle, label: menu.name })),
    [dataSources.menus],
  );
  const menuEditing = useMemo(
    () => ({
      renderEditor: props.menuEditor,
      choices: menuChoices,
      editingFor: editingMenuFor,
      setEditingFor: setEditingMenuFor,
      pickedMenuItem,
    }),
    [props.menuEditor, menuChoices, editingMenuFor, pickedMenuItem],
  );
  const site = props.site;
  // A page with its own header or footer shows it instead of the site's, as the website does.
  // The site's own navigation (or footer), shown or hidden here, takes the automatic one's place.
  const ownChrome = useMemo(() => {
    const own = ownSiteChrome(state.document.root);
    const root = state.document.root;
    return {
      header:
        own.header || hasSiteSection(root, "navigation") || isHiddenOnPage(root, "navigation"),
      footer: own.footer || hasSiteSection(root, "footer") || isHiddenOnPage(root, "footer"),
    };
  }, [state.document.root]);
  // While a state is being styled (hover, or "while the card is hovered"), the page shows it.
  const [stylingState, setStylingState] = useState<{ nodeId: string; target: StyleTarget } | null>(
    null,
  );
  const reportStylingState = useCallback(
    (nodeId: string, target: StyleTarget | null) =>
      setStylingState(target ? { nodeId, target } : null),
    [],
  );
  // The selected element's scroll scene, as Start and End lines on the canvas to drag. A held
  // (pinned) scene runs while it's held, so it has no lines of its own.
  // The first scroll scene on the selected element, if it has one.
  const selectedScene = selectedNode?.animations?.find(
    (animation) => animation.spec.trigger.type === "scroll",
  );
  const selectedTrigger = selectedScene?.spec.trigger;
  const sceneStart =
    selectedTrigger?.type === "scroll" &&
    selectedTrigger.scope === "element" &&
    !selectedTrigger.pin
      ? selectedTrigger.start.viewport
      : null;
  const sceneEnd =
    selectedTrigger?.type === "scroll" && sceneStart !== null ? selectedTrigger.end.viewport : null;
  const sceneMarkers = useMemo(
    () =>
      sceneStart === null || sceneEnd === null
        ? null
        : {
            start: sceneStart,
            end: sceneEnd,
            startLabel: text("pageBuilder.scene.start"),
            endLabel: text("pageBuilder.scene.end"),
            dragHint: text("pageBuilder.scene.dragHint"),
          },
    [sceneStart, sceneEnd, text],
  );
  const statePreviewCss = useMemo(() => {
    if (!stylingState || stylingState.nodeId !== selectedId) return "";
    const root = state.document.root;
    return compileStatePreview(
      root,
      assignClassNames(root, catalogue),
      stylingState.nodeId,
      stylingState.target,
    );
  }, [stylingState, selectedId, state.document.root, catalogue]);
  const canvasCss = useMemo(
    () =>
      `${
        site
          ? `${withoutTagStyles(site.stylesheet)}\n${tagStylesCss}\n${rendered.css}`
          : `${props.themeStylesheet ?? defaultThemeStylesheet}\n${standInBaseStylesheet}\n${props.baseStylesheet ?? ""}\n${designBaseStylesheet}\n${tagStylesCss}\n${rendered.css}`
      }${ownChrome.header ? '\n[data-lintel-site-chrome="header"]{display:none}' : ""}${
        ownChrome.footer ? '\n[data-lintel-site-chrome="footer"]{display:none}' : ""
      }${statePreviewCss ? `\n${statePreviewCss}` : ""}${variablesCss ? `\n${variablesCss}` : ""}`,
    [
      site,
      props.themeStylesheet,
      props.baseStylesheet,
      rendered.css,
      tagStylesCss,
      ownChrome,
      statePreviewCss,
      variablesCss,
    ],
  );

  const previewMotion = useCallback(
    (nodeId: string, spec: MotionSpec) =>
      setMotionPreview((current) => ({ nodeId, spec, playId: (current?.playId ?? 0) + 1 })),
    [],
  );
  const effectModules = props.effectModules;
  const previewEffect = useCallback(
    (nodeId: string, effect: EffectPreview | null) =>
      setMotionPreview((current) =>
        effect && effectModules
          ? { nodeId, effect, modules: effectModules, playId: (current?.playId ?? 0) + 1 }
          : null,
      ),
    [effectModules],
  );
  const pageWeight = useMemo(() => {
    const used = collectNodeEffects(root).flatMap(({ effects }) =>
      effects.flatMap((saved) => effectRegistry.find(saved.effect) ?? []),
    );
    return measurePageWeight(used, props.siteEffects?.value);
  }, [root, props.siteEffects?.value]);

  const selectFromPanel = useCallback(
    (nodeId: string | null) => {
      actions.select(nodeId);
      setRevealId(nodeId);
    },
    [actions],
  );

  // Deleting the site's navigation or footer asks first: this page, or every page.
  const [removingSlot, setRemovingSlot] = useState<SiteSectionSlot | null>(null);
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
        case "remove": {
          // The site's navigation or footer: ask whether it goes from this page or every page.
          const slot = selected ? siteSectionSlotOf(selected) : null;
          if (slot && !isLocked(state.document, selected ?? "")) setRemovingSlot(slot);
          else actions.remove();
          break;
        }
        case "save":
          onSaveNow?.();
          break;
        case "bold":
        case "italic":
        case "link": {
          const words = selectedWords(state.document, textSelection);
          if (!words) return false;
          if (command === "link") {
            setLinkRequest((count) => count + 1);
          } else {
            actions.markText(
              words.selection,
              toggleChange(words.marks, words.from, words.to, command),
              text(`pageBuilder.inlineText.${command}`),
            );
          }
          break;
        }
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
        case "bringForward":
        case "sendBackward":
        case "bringToFront":
        case "sendToBack":
          if (selected) {
            actions.restack(
              selected,
              (
                {
                  bringForward: "forward",
                  sendBackward: "backward",
                  bringToFront: "front",
                  sendToBack: "back",
                } as const
              )[command],
            );
          }
          break;
      }
      return true;
    },
    [actions, state.selectedId, state.document, textSelection, text, onSaveNow],
  );

  // Something dragged from Insert, and where it would land on the canvas.
  const insertDrag = useRef<InsertItem | null>(null);
  const [isInsertDragging, setIsInsertDragging] = useState(false);
  const [canvasDrop, setCanvasDrop] = useState<CanvasDropTarget | null>(null);
  const canvasDropRef = useRef<CanvasDropTarget | null>(null);
  const showCanvasDrop = useCallback((target: CanvasDropTarget | null) => {
    canvasDropRef.current = target;
    setCanvasDrop((current) =>
      current?.nodeId === target?.nodeId &&
      current?.position === target?.position &&
      current?.across === target?.across
        ? current
        : target,
    );
  }, []);
  const insertMarker = useMemo(
    () =>
      canvasDrop
        ? { nodeId: canvasDrop.nodeId, position: canvasDrop.position, across: canvasDrop.across }
        : null,
    [canvasDrop],
  );

  const handleFrameMessage = useCallback(
    (message: MessageFromFrame) => {
      if (message.type === "insertOver") {
        const dragged = insertDrag.current;
        showCanvasDrop(
          dragged
            ? canvasDropTarget(state.document.root, catalogue, dragged.type, message.chain)
            : null,
        );
      }
      if (message.type === "moveOver") {
        const root = state.document.root;
        // A locked element stays where it is, as it does in Layers.
        const moved = isLocked(state.document, message.nodeId)
          ? undefined
          : findNode(root, message.nodeId);
        // Never into itself: what it holds can't be where it goes.
        const chain = message.chain.filter(
          (over) => moved !== undefined && findNode(moved, over.nodeId) === undefined,
        );
        showCanvasDrop(moved ? canvasDropTarget(root, catalogue, moved.type, chain) : null);
      }
      if (message.type === "moveDrop") {
        const target = canvasDropRef.current;
        if (target) {
          actions.moveTo(message.nodeId, target.place.parentId, target.place.index);
          actions.select(message.nodeId);
        }
        showCanvasDrop(null);
      }
      if (message.type === "moveCancel") showCanvasDrop(null);
      if (message.type === "insertLeave") showCanvasDrop(null);
      if (message.type === "insertDrop") {
        const dragged = insertDrag.current;
        const target = canvasDropRef.current;
        if (dragged && target) actions.insert(dragged.key, target.place);
        showCanvasDrop(null);
      }
      if (message.type === "select") {
        actions.select(message.nodeId);
        setPickedMenuItem(
          message.menuItem && message.nodeId
            ? { nodeId: message.nodeId, ...message.menuItem }
            : null,
        );
      }
      if (message.type === "hover") setHoveredId(message.nodeId);
      if (message.type === "editText") actions.editText(message.nodeId, message.prop, message.text);
      if (message.type === "key") runShortcut(message.key);
      if (message.type === "look") {
        setCanvasLook({
          nodeId: message.nodeId,
          textAlign: message.textAlign,
          fontSize: message.fontSize,
          fontWeight: message.fontWeight,
          color: message.color,
          gridColumns: message.gridColumns ?? 0,
        });
      }
      if (message.type === "paste") actions.paste(message);
      if (message.type === "dropFiles") {
        void pictures.placePictures(message.nodeId, message.files, "drop");
      }
      if (message.type === "pasteFiles") {
        void pictures.placePictures(selectedId, message.files, "paste");
      }
      if (message.type === "textSelection") {
        setTextSelection(message.nodeId === null ? null : message);
      }
      if (message.type === "rotate") {
        actions.changeStyles(
          message.nodeId,
          breakpoint,
          { rotate: message.degrees === 0 ? undefined : `${message.degrees}deg` },
          text("pageBuilder.design.rotate"),
        );
      }
      if (message.type === "place") {
        actions.placeFreely(message.nodeId, breakpoint, { left: message.left, top: message.top });
      }
      if (message.type === "gridPlace") {
        const { nodeId, column, columnSpan, row, rowSpan } = message;
        actions.placeOnGrid(nodeId, breakpoint, { column, columnSpan, row, rowSpan });
        if (nodeId !== state.selectedId) actions.select(nodeId);
      }
      if (message.type === "sceneMarker") {
        const node = state.selectedId ? findNode(state.document.root, state.selectedId) : undefined;
        const animations = node?.animations ?? [];
        const index = animations.findIndex((animation) => animation.spec.trigger.type === "scroll");
        const animation = animations[index];
        const trigger = animation?.spec.trigger;
        if (node && animation && trigger?.type === "scroll") {
          const moved = {
            ...animation,
            spec: {
              ...animation.spec,
              trigger: {
                ...trigger,
                [message.which]: { ...trigger[message.which], viewport: message.viewport },
              },
            },
          };
          actions.animate(
            node.id,
            animations.map((saved, at) => (at === index ? moved : saved)),
          );
        }
      }
      if (message.type === "openMenu") {
        actions.select(message.nodeId);
        setEditingMenuFor(message.nodeId);
      }
    },
    [
      actions,
      runShortcut,
      breakpoint,
      text,
      state.document,
      state.selectedId,
      catalogue,
      showCanvasDrop,
      pictures,
      selectedId,
    ],
  );

  // Pasting while the builder (not a text box) has focus imports what's on the clipboard.
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length > 0 && pictures.canPlacePictures) {
        void pictures.placePictures(selectedId, files, "paste");
        return;
      }
      actions.paste({
        html: event.clipboardData?.getData("text/html") ?? "",
        text: event.clipboardData?.getData("text/plain") ?? "",
      });
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [actions, pictures, selectedId]);

  const handleKeyDownRef = useRef(handleKeyDown);
  useLayoutEffect(() => {
    handleKeyDownRef.current = handleKeyDown;
  });
  useEffect(() => {
    // With focus on the page itself (after clicking empty space), keys never reach the
    // builder's own element, so Undo and Redo are caught here too.
    function handleStrayKeyDown(event: globalThis.KeyboardEvent) {
      if (event.target === document.body || event.target === document.documentElement) {
        handleKeyDownRef.current(event);
      }
    }
    document.addEventListener("keydown", handleStrayKeyDown);
    return () => document.removeEventListener("keydown", handleStrayKeyDown);
  }, []);

  function handleKeyDown(event: BuilderKeyEvent) {
    if (isTypingTarget(event.target)) {
      const command = shortcutFor(event);
      // Undo inside a text box belongs to the text box; the builder's own save always works.
      // Controls that keep their arrow keys (tabs, choices, menus) still pass Undo and Redo on.
      const passesOn = isTextEntry(event.target)
        ? command === "save"
        : command === "save" || command === "undo" || command === "redo";
      if (!passesOn) return;
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
  // A page with nothing at all shows only the start card; one with just the site's navigation
  // (or footer) shows it on the canvas, with the start card below it.
  const isBlank = root.children.length === 0;
  const showsStart = !hasOwnContent(root);
  const labels = useMemo(() => {
    const nameOf = (nodeId: string | null) => {
      const node = nodeId ? findNode(state.document.root, nodeId) : undefined;
      if (!node) return null;
      // The site's navigation says it's on every page, so nobody edits it by surprise.
      const slot = siteSectionSlotOf(node.id);
      return slot
        ? text("pageBuilder.siteSection.onEveryPage", {
            name: text(`pageBuilder.siteSection.label.${slot}`),
          })
        : layerName(node, catalogue);
    };
    return { selected: nameOf(selectedId), hovered: nameOf(hoveredId) };
  }, [state.document, selectedId, hoveredId, catalogue, text]);
  const selectedSiteSection = siteSectionAround(root, selectedId);
  // A site's first navigation (or footer) replaces the automatic one: say so, once.
  const [switchNoteDismissed, setSwitchNoteDismissed] = useState(false);
  const switchedSlot =
    props.siteSections && !switchNoteDismissed
      ? (["navigation", "footer"] as const).find(
          (slot) => !sharedSections.had[slot] && hasSiteSection(root, slot),
        )
      : undefined;
  // A page whose first section is its own menu: offer to mark it, so it never gets two.
  const [offerDismissed, setOfferDismissed] = usePreference(
    preferences,
    "ownNavigationOfferDismissed",
    (stored) => stored ?? "",
  );
  const ownNavigationOffer = useMemo(() => unmarkedOwnNavigation(root), [root]);
  const offeredId =
    props.siteSections &&
    ownNavigationOffer &&
    !offerDismissed.split(",").includes(ownNavigationOffer.id)
      ? ownNavigationOffer.id
      : null;

  const showsTour = isTouring || tourSeen === "no";
  const closeTour = () => {
    setIsTouring(false);
    setTourSeen("yes");
  };
  // The empty page's buttons: Insert, on the right segment, ready to search.
  const openInsert = (kind: InsertFocusRequest["kind"]) => {
    setLeftTab("insert");
    setInsertFocusRequest((current) => ({ kind, count: (current?.count ?? 0) + 1 }));
  };

  return (
    <PreferenceStoreContext.Provider value={preferences}>
      <BlocksProvider blocks={blocks} master={props.blockMaster ?? null}>
        <SiteDesignContext value={siteDesignTools}>
          <DataSourcesContext.Provider value={dataSources}>
            <MenuEditingContext.Provider value={menuEditing}>
              <div
                className="flex h-dvh flex-col bg-background text-label"
                onKeyDown={handleKeyDown}
              >
                <Toolbar
                  title={props.title}
                  titleNote={props.toolbarTitleNote}
                  afterTitle={props.toolbarAfterTitle}
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
                  onReplayTour={() => setIsTouring(true)}
                  onShowTips={tips.showAgain}
                />
                <div className="flex min-h-0 flex-1">
                  <aside
                    aria-label={text("pageBuilder.panels.leftLabel")}
                    className="flex w-72 shrink-0 flex-col border-e border-separator bg-surface"
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
                          enabledPlugins={props.enabledPlugins}
                          blocks={props.blockMaster ? undefined : blocks.library}
                          onInsert={(key) => actions.insert(key)}
                          onDragChange={(item) => {
                            insertDrag.current = item;
                            setIsInsertDragging(item !== null);
                            if (!item) showCanvasDrop(null);
                          }}
                          focusRequest={insertFocusRequest}
                          draftButton={draftButton("row")}
                        />
                      )}
                    </div>
                  </aside>
                  <main
                    className="relative flex min-w-0 flex-1 flex-col"
                    aria-label={text("pageBuilder.canvas.regionLabel")}
                  >
                    <Breadcrumbs
                      root={root}
                      catalogue={catalogue}
                      selectedId={selectedId}
                      onSelect={selectFromPanel}
                    />
                    {!isBlank && selectedSiteSection && (
                      <SiteSectionStrip
                        slot={selectedSiteSection}
                        onHide={() => actions.setSiteSectionHidden(selectedSiteSection, true)}
                        onRemove={
                          props.siteSections?.onChange
                            ? () => setRemovingSlot(selectedSiteSection)
                            : undefined
                        }
                      />
                    )}
                    {!isBlank && textSelection && (
                      <SelectedWordsBar
                        document={state.document}
                        selection={textSelection}
                        onApply={(styles, label) => actions.markText(textSelection, styles, label)}
                        linkRequest={linkRequest}
                      />
                    )}
                    {showsStart && (
                      <EmptyPage
                        starterSites={props.starterSites ?? allStarterSites}
                        onAddSection={() => openInsert("sections")}
                        onAddElements={() => openInsert("elements")}
                        onChooseStarterPage={actions.useStarterPage}
                        takesFocus={!showsTour}
                        draftButton={draftButton("link")}
                        belowSiteSections={!isBlank}
                      />
                    )}
                    {!isBlank && (
                      <Canvas
                        html={rendered.html}
                        css={canvasCss}
                        breakpoint={breakpoint}
                        selectedId={selectedId}
                        hoveredId={hoveredId}
                        highlightIds={
                          selectedId && highlight.includes(selectedId) ? highlight : undefined
                        }
                        labels={labels}
                        revealId={revealId}
                        canTransform={selectedNode !== undefined && !selectedIsLocked}
                        site={site}
                        scripts={props.frameScripts}
                        motionPreview={motionPreview}
                        insertMarker={insertMarker}
                        isInsertDragging={isInsertDragging}
                        sceneMarkers={sceneMarkers}
                        onMessage={handleFrameMessage}
                      />
                    )}
                    {removingSlot && (
                      <SiteSectionRemoveDialog
                        slot={removingSlot}
                        onHideHere={() => {
                          actions.setSiteSectionHidden(removingSlot, true);
                          setRemovingSlot(null);
                        }}
                        onRemoveEverywhere={
                          props.siteSections?.onChange
                            ? () => {
                                actions.removeSiteSectionFromSite(removingSlot);
                                setRemovingSlot(null);
                              }
                            : undefined
                        }
                        onCancel={() => setRemovingSlot(null)}
                      />
                    )}
                    <PictureDropStatus status={pictures.status} onDismiss={pictures.dismiss} />
                    {!pictures.status && switchedSlot && (
                      <SiteSectionNote
                        message={text(`pageBuilder.siteSection.switched.${switchedSlot}`)}
                        action={{
                          label: text("pageBuilder.siteSection.switched.undo"),
                          onClick: () => actions.removeSiteSectionFromSite(switchedSlot),
                        }}
                        onDismiss={() => setSwitchNoteDismissed(true)}
                      />
                    )}
                    {!pictures.status && !switchedSlot && !showsStart && offeredId && (
                      <SiteSectionNote
                        message={text("pageBuilder.siteSection.offer")}
                        action={{
                          label: text("pageBuilder.siteSection.offer.yes"),
                          onClick: () => actions.markAsPageOwn(offeredId, "navigation"),
                        }}
                        dismissLabel={text("pageBuilder.siteSection.offer.no")}
                        onDismiss={() =>
                          setOfferDismissed(
                            [...offerDismissed.split(",").filter(Boolean), offeredId]
                              .slice(-50)
                              .join(","),
                          )
                        }
                      />
                    )}
                  </main>
                  <CanvasLookContext value={canvasLook}>
                    <PictureBaseUrlContext value={site?.baseUrl ?? null}>
                      <SelectedElementPanel
                        document={state.document}
                        node={selectedNode ?? null}
                        nodeName={labels.selected ?? ""}
                        definition={definition}
                        isLocked={selectedIsLocked}
                        breakpoint={breakpoint}
                        registry={registry}
                        canEditCode={canEditCode}
                        tips={tips}
                        pickImage={props.pickImage}
                        uploadFile={props.uploadFile}
                        motionText={props.motionText}
                        siteCursorOn={cursorIsOn(props.siteEffects?.value.cursor)}
                        actions={{
                          ...actions,
                          animate: (nodeId, animations) => {
                            actions.animate(nodeId, animations);
                            if (animations.length === 0) setMotionPreview(null);
                          },
                        }}
                        onPreviewMotion={previewMotion}
                        onPreviewEffect={previewEffect}
                        onStyleStateChange={reportStylingState}
                        onPointAtElement={setHoveredId}
                        onSelectMany={(nodeIds) => {
                          const first = nodeIds[0];
                          if (!first) return;
                          setHighlight(nodeIds);
                          selectFromPanel(first);
                          announce(
                            text("pageBuilder.siteStyles.selected", { count: nodeIds.length }),
                          );
                        }}
                        effectModules={props.effectModules}
                        pageWeight={pageWeight}
                        pageSettings={
                          props.siteSections && (
                            <PageSiteSections
                              page={root}
                              onChange={(slot, hidden) =>
                                actions.setSiteSectionHidden(slot, hidden)
                              }
                            />
                          )
                        }
                        sectionTools={
                          props.siteSections?.onChange && (
                            <SectionSiteTools
                              root={root}
                              node={selectedNode ?? null}
                              onUseAsSite={(slot) => {
                                if (selectedNode) actions.useAsSiteSection(selectedNode.id, slot);
                              }}
                              onUseAsOwn={() => {
                                if (selectedNode)
                                  actions.markAsPageOwn(selectedNode.id, "navigation");
                              }}
                            />
                          )
                        }
                        siteMotion={
                          props.siteEffects && (
                            <SiteMotionSettingsWithColours
                              value={props.siteEffects.value}
                              onChange={props.siteEffects.onChange}
                              translate={props.motionText}
                              pickPicture={props.pickImage}
                            />
                          )
                        }
                      />
                    </PictureBaseUrlContext>
                  </CanvasLookContext>
                </div>
                {showsTour && <GuidedTour onClose={closeTour} />}
                {/* The same sentence twice in a row is still read out: the space changes the text. */}
                <div role="status" aria-live="polite" className="sr-only">
                  {announcement.message}
                  {announcement.count % 2 === 1 ? "\u00a0" : ""}
                </div>
              </div>
            </MenuEditingContext.Provider>
          </DataSourcesContext.Provider>
        </SiteDesignContext>
      </BlocksProvider>
    </PreferenceStoreContext.Provider>
  );
}

/** The parts of a key press the builder reads, from React's event or the browser's own. */
interface BuilderKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
}
