import type {
  AnyComponentDefinition,
  Breakpoint,
  NodeAnimation,
  PageDocument,
  PageNode,
  StylePropertyName,
  StyleTarget,
} from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import type { Translate as MotionText } from "@lintel/motion-editor";
import { useState } from "react";
import { AnimatePanel } from "../animate-panel/AnimatePanel.js";
import { CodePanel } from "../developer/CodePanel.js";
import { useBuilderText } from "../i18n/builder-text.js";
import type { ComponentRegistry } from "../render/component-registry.js";
import type { SkillLevelTools } from "../skill-level/skill-levels.js";
import { type StateChoice, StylePanel, type StylePanelMode } from "../style-panel/StylePanel.js";
import { Tip } from "../tour/Tip.js";
import { Tabs } from "../ui/controls.js";
import type { ImagePicker } from "./content-fields.js";
import { ContentPanel } from "./ContentPanel.js";

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
  motionText?: MotionText;
  /** Opens the Code tab, as switching to Developer does. */
  showCode: boolean;
  actions: {
    changeStyles: (nodeId: string, target: StyleTarget, values: StyleValues, label: string) => void;
    changeProps: (nodeId: string, props: Record<string, unknown>, label: string) => void;
    changeBinding: (nodeId: string, prop: string, fieldPath: string | null, label: string) => void;
    animate: (nodeId: string, animation: NodeAnimation | null) => void;
    applyHtml: (nodeId: string, html: string) => void;
    convertToCode: (nodeId: string) => void;
    changeCode: (nodeId: string, code: { html: string; css: string; js: string }) => void;
    pasteHtml: (html: string) => void;
  };
  onPreviewMotion: (nodeId: string, spec: MotionSpec) => void;
}

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
  const tab = chosenTab === "code" && !tools.codeTools ? "style" : chosenTab;

  const tabs: Array<{ value: RightTab; label: string }> = [
    { value: "style", label: text("pageBuilder.panels.style") },
    { value: "content", label: text("pageBuilder.panels.content") },
    { value: "animate", label: text("pageBuilder.panels.animate") },
    ...(tools.codeTools
      ? [{ value: "code" as const, label: text("pageBuilder.panels.code") }]
      : []),
  ];

  return (
    <aside
      aria-label={text("pageBuilder.panels.rightLabel")}
      className="flex w-80 shrink-0 flex-col border-l border-separator bg-surface"
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
          <p className="px-4 py-6 text-footnote text-label-secondary">
            {text(
              tab === "animate"
                ? "pageBuilder.animate.selectSomething"
                : "pageBuilder.panels.selectSomething",
            )}
          </p>
        ) : tab === "style" ? (
          <StylePanel
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
          />
        ) : tab === "animate" ? (
          <AnimatePanel
            node={node}
            name={props.nodeName}
            isLocked={props.isLocked}
            showsTimeline={tools.animationTimeline}
            motionText={props.motionText}
            tips={props.tips}
            onChange={(animation) => actions.animate(node.id, animation)}
            onPreview={(spec) => props.onPreviewMotion(node.id, spec)}
          />
        ) : (
          <ContentPanel
            node={node}
            definition={props.definition}
            isLocked={props.isLocked}
            pickImage={props.pickImage}
            onChange={(changed, label) => actions.changeProps(node.id, changed, label)}
            document={props.document}
            onBind={(prop, fieldPath, label) =>
              actions.changeBinding(node.id, prop, fieldPath, label)
            }
          />
        )}
      </div>
    </aside>
  );
}
