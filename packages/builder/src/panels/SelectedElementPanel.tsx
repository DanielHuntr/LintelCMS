import {
  type AnyComponentDefinition,
  type BackgroundVideo,
  type BoundPicture,
  type Breakpoint,
  findPath,
  type FreeLayout,
  type GridPlace,
  type PlacedGrid,
  type NodeAnimation,
  type NodeEffect,
  type PageDocument,
  type PageFont,
  type PageNode,
  readPageFonts,
  rootNodeId,
  type StackingMove,
  type StylePropertyName,
  type StateTransition,
  type StyleTarget,
  type CustomBlock,
  customBlockType,
} from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import type { Translate as MotionText } from "@lintel/motion-editor";
import { type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePanel, type EffectPreview } from "../animate-panel/AnimatePanel.js";
import type { PageWeight } from "@lintel/motion/effects";
import { BlockInstancePanel } from "../blocks/BlockInstancePanel.js";
import { BlockTools } from "../blocks/BlockTools.js";
import { useBlockMaster, useBuilderBlocks } from "../blocks/blocks-context.js";
import { CodePanel } from "../developer/CodePanel.js";
import { useBuilderText } from "../i18n/builder-text.js";
import type { ComponentRegistry } from "../render/component-registry.js";
import type { SkillLevelTools } from "../skill-level/skill-levels.js";
import type { MarkChange } from "../inline-text/TextStyleBar.js";
import type { DesignTools, FileUploader } from "../style-panel/design-tools.js";
import {
  type StateChoice,
  type StateOwner,
  StylePanel,
  type StylePanelMode,
} from "../style-panel/StylePanel.js";
import { layerName } from "../editor/commands.js";
import { Tip } from "../tour/Tip.js";
import { Tabs } from "../ui/controls.js";
import type { ImagePicker } from "./content-fields.js";
import { ContentPanel } from "./ContentPanel.js";
import { MenuEditingContext } from "../menus/menu-editing.js";

type RightTab = "style" | "content" | "animate" | "code";

type StyleValues = Partial<Record<StylePropertyName, string | undefined>>;

interface SelectedElementPanelProps {
  document: PageDocument;
  node: PageNode | null;
  nodeName: string;
  definition: AnyComponentDefinition | undefined;
  isLocked: boolean;
  breakpoint: Breakpoint;
  registry: ComponentRegistry;
  tools: SkillLevelTools;
  tips: { isDismissed: (tip: string) => boolean; dismiss: (tip: string) => void };
  pickImage?: ImagePicker;
  uploadFile?: FileUploader;
  motionText?: MotionText;
  /** Opens the Code tab, as switching to Developer does. */
  showCode: boolean;
  actions: {
    changeStyles: (nodeId: string, target: StyleTarget, values: StyleValues, label: string) => void;
    changeProps: (nodeId: string, props: Record<string, unknown>, label: string) => void;
    changeBinding: (nodeId: string, prop: string, fieldPath: string | null, label: string) => void;
    animate: (nodeId: string, animations: NodeAnimation[]) => void;
    setEffects: (nodeId: string, effects: NodeEffect[]) => void;
    setStateTransition: (nodeId: string, transition: StateTransition | null) => void;
    applyHtml: (nodeId: string, html: string) => void;
    convertToCode: (nodeId: string) => void;
    changeCode: (nodeId: string, code: { html: string; css: string; js: string }) => void;
    pasteHtml: (html: string) => void;
    setFreeLayout: (nodeId: string, freeLayout: FreeLayout | null) => void;
    setPlacedGrid: (nodeId: string, placedGrid: PlacedGrid | null) => void;
    placeOnGrid: (nodeId: string, target: Breakpoint, place: GridPlace) => void;
    setBackgroundVideo: (nodeId: string, video: BackgroundVideo | null) => void;
    changePageFonts: (fonts: PageFont[], label: string) => void;
    restack: (nodeId: string, move: StackingMove) => void;
    replaceWithBlock: (nodeId: string, block: CustomBlock) => void;
    detachBlock: (nodeId: string, pictures?: Readonly<Record<string, BoundPicture>>) => void;
    changeBlockValues: (nodeId: string, values: Record<string, unknown>, blockName: string) => void;
    replaceDesign: (nodeId: string, design: PageNode) => void;
    markText: (
      selection: { nodeId: string; prop: string; from: number; to: number; text: string },
      styles: MarkChange | null,
      label: string,
    ) => void;
  };
  onPreviewMotion: (nodeId: string, spec: MotionSpec) => void;
  onPreviewEffect: (nodeId: string, effect: EffectPreview | null) => void;
  /** Where each effect module is served, for previews on the canvas and in the gallery. */
  effectModules?: Readonly<Record<string, string>>;
  pageWeight?: PageWeight;
  /** Site-wide motion settings, shown when nothing is selected on the Animate tab. */
  siteMotion?: ReactNode;
  /** Told which state is being styled, so the canvas can show it; null for none. */
  onStyleStateChange?: (nodeId: string, target: StyleTarget | null) => void;
}

/** How many elements around the selected one are offered as owners of its states. */
const maxStateOwners = 3;

/**
 * The right-hand side: Style, Content and Animate for the selected element, and Code for
 * developers. Which controls each shows follows the skill level.
 */
export function SelectedElementPanel(props: SelectedElementPanelProps) {
  const text = useBuilderText();
  const { node, tools, actions } = props;
  const [chosenTab, setTab] = useState<RightTab>("style");
  const [styleMode, setStyleMode] = useState<StylePanelMode>("simple");
  const [styleState, setStyleState] = useState<StateChoice>("none");
  const wantsCode = props.showCode && tools.codeTools;
  const [lastShowCode, setLastShowCode] = useState(wantsCode);
  if (wantsCode !== lastShowCode) {
    setLastShowCode(wantsCode);
    if (wantsCode) setTab("code");
  }
  // "Add pages to your menu" on the canvas opens the menu editor, which is in Content.
  const { editingFor: editingMenuFor } = useContext(MenuEditingContext);
  const [lastEditingMenuFor, setLastEditingMenuFor] = useState(editingMenuFor);
  if (editingMenuFor !== lastEditingMenuFor) {
    setLastEditingMenuFor(editingMenuFor);
    if (editingMenuFor !== null) setTab("content");
  }
  const tab = chosenTab === "code" && !tools.codeTools ? "style" : chosenTab;
  const { document, pickImage, uploadFile } = props;
  // The elements around the selected one, nearest first, whose states it can follow.
  const stateOwners = useMemo<StateOwner[]>(() => {
    if (!node) return [];
    return findPath(document.root, node.id)
      .slice(1, -1)
      .reverse()
      .slice(0, maxStateOwners)
      .map((around) => ({
        id: around.id,
        name: layerName(around, props.registry.catalogue),
        stateTransition: around.stateTransition,
      }));
  }, [node, document, props.registry]);
  const onStyleStateChange = props.onStyleStateChange;
  const showsStyleState = tab === "style" && styleState !== "none";
  useEffect(() => {
    if (!onStyleStateChange || !node) return;
    onStyleStateChange(node.id, showsStyleState ? styleState : null);
  }, [onStyleStateChange, node, showsStyleState, styleState]);
  const design = useMemo<DesignTools | null>(() => {
    if (!node) return null;
    const parent = findPath(document.root, node.id).at(-2);
    return {
      node,
      parent: parent && parent.id !== rootNodeId ? parent : null,
      pageFonts: readPageFonts(document.root.props),
      changePageFonts: actions.changePageFonts,
      setFreeLayout: (freeLayout) => actions.setFreeLayout(node.id, freeLayout),
      setPlacedGrid: (placedGrid) => actions.setPlacedGrid(node.id, placedGrid),
      placeOnGrid: (target, place) => actions.placeOnGrid(node.id, target, place),
      setBackgroundVideo: (video) => actions.setBackgroundVideo(node.id, video),
      restack: (move) => actions.restack(node.id, move),
      pickImage,
      uploadFile,
    };
  }, [node, document, actions, pickImage, uploadFile]);

  const tabs: Array<{ value: RightTab; label: string }> = [
    { value: "style", label: text("pageBuilder.panels.style") },
    { value: "content", label: text("pageBuilder.panels.content") },
    { value: "animate", label: text("pageBuilder.panels.animate") },
    ...(tools.codeTools
      ? [{ value: "code" as const, label: text("pageBuilder.panels.code") }]
      : []),
  ];

  const blocks = useBuilderBlocks();
  const master = useBlockMaster();
  const blockTools = (
    <BlockTools
      document={document}
      node={node}
      nodeName={props.nodeName}
      catalogue={props.registry.catalogue}
      onMadeBlock={actions.replaceWithBlock}
      onReplaceDesign={actions.replaceDesign}
    />
  );

  // An instance of one of the site's blocks: its design is the block's, so only its details
  // can be changed here.
  if (node?.type === customBlockType && !master) {
    return (
      <aside
        data-tour="selected-element"
        aria-label={text("pageBuilder.panels.rightLabel")}
        className="flex w-80 shrink-0 flex-col overflow-auto border-s border-separator bg-surface"
      >
        <BlockInstancePanel
          node={node}
          isLocked={props.isLocked}
          onChange={(values, blockName) => actions.changeBlockValues(node.id, values, blockName)}
          onDetach={() => actions.detachBlock(node.id, blocks.pictures)}
        />
      </aside>
    );
  }

  return (
    <aside
      data-tour="selected-element"
      aria-label={text("pageBuilder.panels.rightLabel")}
      className="flex w-80 shrink-0 flex-col border-s border-separator bg-surface"
    >
      <Tabs<RightTab>
        label={text("pageBuilder.panels.rightLabel")}
        idPrefix="lintel-right"
        value={tab}
        onChange={setTab}
        tabs={tabs}
      />
      <div
        id="lintel-right-panel"
        role="tabpanel"
        aria-labelledby={`lintel-right-tab-${tab}`}
        className="min-h-0 flex-1 overflow-auto"
      >
        {tab === "code" ? (
          <CodePanel
            document={props.document}
            node={node}
            registry={props.registry}
            isLocked={props.isLocked}
            onApplyHtml={actions.applyHtml}
            onConvertToCode={actions.convertToCode}
            onChangeCode={actions.changeCode}
            onPasteHtml={actions.pasteHtml}
          />
        ) : !node ? (
          <>
            <p className="px-4 py-6 text-footnote text-label-secondary">
              {text(
                tab === "animate"
                  ? "pageBuilder.animate.selectSomething"
                  : "pageBuilder.panels.selectSomething",
              )}
            </p>
            {tab === "animate" && props.siteMotion && (
              <div className="px-4 pb-6">{props.siteMotion}</div>
            )}
          </>
        ) : tab === "style" && design ? (
          <StylePanel
            design={design}
            node={node}
            definition={props.definition}
            breakpoint={props.breakpoint}
            mode={styleMode}
            onModeChange={setStyleMode}
            state={styleState}
            onStateChange={setStyleState}
            isLocked={props.isLocked}
            allowsAdvanced={tools.advancedStyles}
            note={
              <Tip id="moreStyles" tips={props.tips}>
                {text("pageBuilder.style.moreInDesigner")}
              </Tip>
            }
            onChange={(target, values, label) =>
              actions.changeStyles(node.id, target, values, label)
            }
            owners={stateOwners}
            onTransitionChange={actions.setStateTransition}
          />
        ) : tab === "animate" ? (
          <AnimatePanel
            node={node}
            name={props.nodeName}
            sceneElements={stateOwners}
            isLocked={props.isLocked}
            showsTimeline={tools.animationTimeline}
            motionText={props.motionText}
            tips={props.tips}
            onChange={(animation) => actions.animate(node.id, animation)}
            onChangeEffects={(effects) => actions.setEffects(node.id, effects)}
            onPreview={(spec) => props.onPreviewMotion(node.id, spec)}
            onPreviewEffect={(effect) => props.onPreviewEffect(node.id, effect)}
            effectModules={props.effectModules}
            pageWeight={props.pageWeight}
          />
        ) : (
          <ContentPanel
            node={node}
            definition={props.definition}
            isLocked={props.isLocked}
            pickImage={props.pickImage}
            onChange={(changed, label) => actions.changeProps(node.id, changed, label)}
            pageFonts={design?.pageFonts}
            onMarkText={(range, styles, label) =>
              actions.markText({ ...range, nodeId: node.id, prop: "text" }, styles, label)
            }
            document={props.document}
            onBind={(prop, fieldPath, label) =>
              actions.changeBinding(node.id, prop, fieldPath, label)
            }
          />
        )}
      </div>
      {blockTools}
    </aside>
  );
}
