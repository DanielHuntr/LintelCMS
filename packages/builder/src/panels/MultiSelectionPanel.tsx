import type {
  BackgroundVideo,
  Breakpoint,
  ComponentCatalogue,
  FreeLayout,
  NodeAnimation,
  NodeEffect,
  PageNode,
  PlacedGrid,
  StylePropertyName,
  StyleTarget,
} from "@lintel/builder-model";
import type { MotionSpec } from "@lintel/motion";
import type { Translate as MotionText } from "@lintel/motion-editor";
import { ArrowDown, ArrowUp, Copy, Group, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AnimatePanel } from "../animate-panel/AnimatePanel.js";
import { sharedLook, sharedType } from "../editor/multi-selection.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { useSiteDesign } from "../site-design/site-design-context.js";
import type { DesignTools } from "../style-panel/design-tools.js";
import { type StateChoice, StylePanel, type StylePanelMode } from "../style-panel/StylePanel.js";
import { inputClassName, Tabs } from "../ui/controls.js";

type ManyTab = "style" | "content" | "animate";

export interface ManyActions {
  changeStyles: (
    ids: readonly string[],
    target: StyleTarget,
    values: Partial<Record<StylePropertyName, string | undefined>>,
    label: string,
  ) => void;
  animate: (ids: readonly string[], animations: NodeAnimation[]) => void;
  setEffects: (ids: readonly string[], effects: NodeEffect[]) => void;
  setFreeLayout: (ids: readonly string[], freeLayout: FreeLayout | null) => void;
  setPlacedGrid: (ids: readonly string[], placedGrid: PlacedGrid | null) => void;
  setBackgroundVideo: (ids: readonly string[], video: BackgroundVideo | null) => void;
  useSharedStyle: (ids: readonly string[], sharedStyleId: string | null) => void;
  remove: (ids: readonly string[]) => void;
  duplicate: (ids: readonly string[]) => void;
  group: (ids: readonly string[]) => void;
  move: (ids: readonly string[], direction: "up" | "down") => void;
}

/**
 * The right-hand side with several elements selected. Style changes go to all of them (a
 * value shows only where they share it, otherwise "Mixed"); Animate puts the same motion on
 * all; Content asks to select one. Under the tabs, what can be done with all of them at once:
 * make them one component, give them a shared style, duplicate, delete, group, move.
 */
export function MultiSelectionPanel({
  nodes,
  catalogue,
  breakpoint,
  design,
  isLocked,
  actions,
  componentTools,
  motionText,
  tips,
  onPreviewMotion,
  onSelectOne,
}: {
  nodes: readonly PageNode[];
  catalogue: ComponentCatalogue;
  breakpoint: Breakpoint;
  /** The first one's design tools, for the controls that need them. */
  design: DesignTools;
  isLocked: boolean;
  actions: ManyActions;
  /** "Make these one component", from the component tools. */
  componentTools: ReactNode;
  motionText?: MotionText;
  tips: { isDismissed: (tip: string) => boolean; dismiss: (tip: string) => void };
  onPreviewMotion: (nodeId: string, spec: MotionSpec) => void;
  onSelectOne: () => void;
}) {
  const text = useBuilderText();
  const site = useSiteDesign();
  const [tab, setTab] = useState<ManyTab>("style");
  const [mode, setMode] = useState<StylePanelMode>("simple");
  const [state, setState] = useState<StateChoice>("none");
  const ids = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const first = nodes[0] as PageNode;
  const look = useMemo(() => sharedLook(nodes), [nodes]);
  const type = sharedType(nodes);
  // One element standing for them all: the styles they share, the kind they all are.
  const standIn = useMemo<PageNode>(
    () => ({
      ...first,
      // Not any one element's id, so no one element's measured look shows as theirs.
      id: "several-selected",
      type: type ?? "box",
      styles: look.styles,
      sharedStyle: undefined,
    }),
    [first, type, look.styles],
  );
  // The tools act on all of them, too. Where each one sits stays its own, so Style doesn't
  // offer it here.
  const tools = useMemo<DesignTools>(
    () => ({
      ...design,
      node: standIn,
      setFreeLayout: (freeLayout) => actions.setFreeLayout(ids, freeLayout),
      setPlacedGrid: (placedGrid) => actions.setPlacedGrid(ids, placedGrid),
      setBackgroundVideo: (video) => actions.setBackgroundVideo(ids, video),
    }),
    [design, standIn, actions, ids],
  );
  const sharedStyles = site.design.sharedStyles;
  const commonSharedStyle = nodes.every((node) => node.sharedStyle === first.sharedStyle)
    ? (first.sharedStyle ?? "")
    : null;
  const count = nodes.length;

  return (
    <aside
      data-tour="selected-element"
      data-multi-selection
      aria-label={text("pageBuilder.panels.rightLabel")}
      className="flex w-80 shrink-0 flex-col border-s border-separator bg-surface"
    >
      <div className="flex h-11 shrink-0 items-center justify-between hairline-bottom px-4">
        <h2 className="text-footnote font-semibold text-label">
          {text("pageBuilder.multi.count", { count })}
        </h2>
        <button
          type="button"
          onClick={onSelectOne}
          className="rounded-control px-2 py-1 text-caption font-medium text-accent hover:bg-fill focus-visible:focus-ring"
        >
          {text("pageBuilder.multi.clear")}
        </button>
      </div>
      <Tabs<ManyTab>
        label={text("pageBuilder.panels.rightLabel")}
        idPrefix="lintel-many"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "style", label: text("pageBuilder.panels.style") },
          { value: "content", label: text("pageBuilder.panels.content") },
          { value: "animate", label: text("pageBuilder.panels.animate") },
        ]}
      />
      <div
        id="lintel-many-panel"
        role="tabpanel"
        aria-labelledby={`lintel-many-tab-${tab}`}
        className="min-h-0 flex-1 overflow-auto"
      >
        {tab === "style" ? (
          <StylePanel
            design={tools}
            node={standIn}
            definition={type ? catalogue.find(type) : catalogue.find("box")}
            breakpoint={breakpoint}
            mode={mode}
            onModeChange={setMode}
            state={state}
            onStateChange={setState}
            isLocked={isLocked}
            note={
              <p className="text-caption text-label-secondary">
                {text("pageBuilder.multi.styleNote", { count })}
              </p>
            }
            onChange={(target, values, label) => actions.changeStyles(ids, target, values, label)}
            mixedStyles={look.mixed}
          />
        ) : tab === "content" ? (
          <p className="px-4 py-6 text-footnote text-label-secondary">
            {text("pageBuilder.multi.contentNote")}
          </p>
        ) : (
          <div className="flex flex-col">
            <p className="px-4 pt-4 text-caption text-label-secondary">
              {text("pageBuilder.multi.animateNote", { count })}
            </p>
            <AnimatePanel
              node={first}
              name={text("pageBuilder.multi.count", { count })}
              isLocked={isLocked}
              motionText={motionText}
              tips={tips}
              onChange={(animations) => actions.animate(ids, animations)}
              onChangeEffects={(effects) => actions.setEffects(ids, effects)}
              onPreview={(spec) => ids.forEach((id) => onPreviewMotion(id, spec))}
              onPreviewEffect={() => undefined}
            />
          </div>
        )}
      </div>
      <section
        aria-label={text("pageBuilder.multi.actions")}
        className="flex flex-col gap-2 hairline-top px-4 py-3"
      >
        <h3 className="text-caption font-semibold text-label-secondary">
          {text("pageBuilder.multi.actions")}
        </h3>
        {componentTools}
        {sharedStyles.length > 0 && (
          <label className="flex flex-col gap-1 text-caption text-label-secondary">
            {text("pageBuilder.multi.sharedStyle")}
            <select
              value={commonSharedStyle ?? ""}
              disabled={isLocked}
              onChange={(event) => actions.useSharedStyle(ids, event.target.value || null)}
              className={inputClassName}
            >
              {commonSharedStyle === null && (
                <option value="" disabled>
                  {text("pageBuilder.multi.mixed")}
                </option>
              )}
              <option value="">{text("pageBuilder.multi.noSharedStyle")}</option>
              {sharedStyles.map((shared) => (
                <option key={shared.id} value={shared.id}>
                  {shared.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-1">
          <ActionButton
            icon={<Copy aria-hidden="true" className="size-3.5" />}
            label={text("pageBuilder.multi.duplicate")}
            onClick={() => actions.duplicate(ids)}
          />
          <ActionButton
            icon={<Group aria-hidden="true" className="size-3.5" />}
            label={text("pageBuilder.multi.group")}
            onClick={() => actions.group(ids)}
          />
          <ActionButton
            icon={<ArrowUp aria-hidden="true" className="size-3.5" />}
            label={text("pageBuilder.multi.moveUp")}
            onClick={() => actions.move(ids, "up")}
          />
          <ActionButton
            icon={<ArrowDown aria-hidden="true" className="size-3.5" />}
            label={text("pageBuilder.multi.moveDown")}
            onClick={() => actions.move(ids, "down")}
          />
          <ActionButton
            icon={<Trash2 aria-hidden="true" className="size-3.5" />}
            label={text("pageBuilder.multi.delete")}
            isDanger
            onClick={() => actions.remove(ids)}
          />
        </div>
      </section>
    </aside>
  );
}

function ActionButton({
  icon,
  label,
  isDanger = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  isDanger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-control px-2 text-start text-footnote font-medium hover:bg-fill focus-visible:focus-ring ${isDanger ? "text-danger" : "text-label"}`}
    >
      {icon}
      {label}
    </button>
  );
}
