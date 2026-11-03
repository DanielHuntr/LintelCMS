import {
  canUseFreeLayout,
  isStateTarget,
  resolveStyle,
  type StackingMove,
} from "@lintel/builder-model";
import { BringToFront, ChevronDown, ChevronUp, SendToBack } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { PanelSection } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { useStyleEditing, useStyleReader } from "./style-field.js";
import { StyleSelect, StyleTextInput } from "./StyleInputs.js";

/**
 * Where things go: a section's free layout (place things anywhere), an element's place and
 * stacking inside a free layout, and an element's place in a grid. Shown only when one of
 * those applies. Free layout and stacking are in Simple too; grid placement is Advanced.
 */
export function ArrangeSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const read = useStyleReader();
  const { target } = useStyleEditing();
  const { node, parent } = tools;
  const isFreeContainer = canUseFreeLayout(node);
  const isFreeChild = parent?.freeLayout !== undefined;
  const parentTarget = isStateTarget(target) ? "base" : target;
  const isGridChild = parent
    ? resolveStyle(parent.styles, parentTarget, "display").value === "grid"
    : false;
  const isGrid = read("display") === "grid";
  const showsGrid = advanced && (isGridChild || isGrid);
  if (!isFreeContainer && !isFreeChild && !showsGrid) return null;

  const summary = node.freeLayout
    ? text("pageBuilder.design.freeLayout")
    : isFreeChild
      ? [read("left"), read("top")].filter(Boolean).join(", ")
      : "";

  return (
    <PanelSection title={text("pageBuilder.design.arrange")} sectionId="arrange" summary={summary}>
      {isFreeContainer && <FreeLayoutToggle />}
      {isFreeChild && <FreePlace advanced={advanced} />}
      {showsGrid && isGridChild && (
        <div className="grid grid-cols-2 gap-2">
          <StyleTextInput
            property="gridColumn"
            label={text("pageBuilder.style.gridColumn")}
            placeholder="1 / span 2"
          />
          <StyleTextInput
            property="gridRow"
            label={text("pageBuilder.design.gridRow")}
            placeholder="2 / span 3"
          />
          <StyleTextInput
            property="gridArea"
            label={text("pageBuilder.design.gridArea")}
            placeholder="photo"
          />
          <StyleSelect
            property="justifySelf"
            label={text("pageBuilder.design.justifySelf")}
            choices={selfAlignments(text)}
          />
          <StyleSelect
            property="alignSelf"
            label={text("pageBuilder.design.alignSelf")}
            choices={selfAlignments(text)}
          />
        </div>
      )}
      {showsGrid && isGrid && (
        <div className="grid grid-cols-2 gap-2">
          <StyleTextInput
            property="gridTemplateRows"
            label={text("pageBuilder.design.gridRows")}
            placeholder="auto 1fr"
          />
          <StyleSelect
            property="justifyItems"
            label={text("pageBuilder.design.justifyItems")}
            choices={selfAlignments(text)}
          />
          <div className="col-span-2">
            <StyleTextInput
              property="gridTemplateAreas"
              label={text("pageBuilder.design.gridAreas")}
              placeholder={'"title photo" "text photo"'}
            />
          </div>
        </div>
      )}
    </PanelSection>
  );
}

function selfAlignments(text: ReturnType<typeof useBuilderText>) {
  return [
    { value: "start", label: text("pageBuilder.style.alignStart") },
    { value: "center", label: text("pageBuilder.style.alignCentre") },
    { value: "end", label: text("pageBuilder.style.alignEnd") },
    { value: "stretch", label: text("pageBuilder.design.stretch") },
  ];
}

function FreeLayoutToggle() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const freeLayout = tools.node.freeLayout;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-footnote text-label">
        <input
          type="checkbox"
          checked={freeLayout !== undefined}
          onChange={(event) =>
            tools.setFreeLayout(event.target.checked ? { stackOnPhone: true } : null)
          }
          className="size-4 accent-[var(--color-accent-fill)]"
        />
        {text("pageBuilder.design.freeLayoutOn")}
      </label>
      <p className="text-caption text-label-tertiary">
        {text("pageBuilder.design.freeLayoutHint")}
      </p>
      {freeLayout && (
        <label className="flex items-center gap-2 text-footnote text-label">
          <input
            type="checkbox"
            checked={freeLayout.stackOnPhone}
            onChange={(event) => tools.setFreeLayout({ stackOnPhone: event.target.checked })}
            className="size-4 accent-[var(--color-accent-fill)]"
          />
          {text("pageBuilder.design.stackOnPhone")}
        </label>
      )}
    </div>
  );
}

/** An element's place in its free layout, and the buttons that stack it. */
function FreePlace({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const moves: Array<{
    move: StackingMove;
    icon: typeof BringToFront;
    key: Parameters<typeof text>[0];
  }> = [
    { move: "front", icon: BringToFront, key: "pageBuilder.design.toFront" },
    { move: "forward", icon: ChevronUp, key: "pageBuilder.design.forward" },
    { move: "backward", icon: ChevronDown, key: "pageBuilder.design.backward" },
    { move: "back", icon: SendToBack, key: "pageBuilder.design.toBack" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-label-tertiary">{text("pageBuilder.design.freePlaceHint")}</p>
      <div className="grid grid-cols-2 gap-2">
        <StyleTextInput
          property="left"
          label={text("pageBuilder.design.fromLeft")}
          placeholder="10%"
        />
        <StyleTextInput
          property="top"
          label={text("pageBuilder.design.fromTop")}
          placeholder="10%"
        />
        <StyleTextInput property="width" label={text("pageBuilder.style.width")} />
        {advanced && (
          <StyleTextInput
            property="zIndex"
            label={text("pageBuilder.style.zIndex")}
            placeholder="auto"
          />
        )}
      </div>
      <div
        role="group"
        aria-label={text("pageBuilder.design.stacking")}
        className="flex flex-wrap gap-1"
      >
        {moves.map(({ move, icon: Icon, key }) => (
          <button
            key={move}
            type="button"
            onClick={() => tools.restack(move)}
            className="flex h-7 items-center gap-1 rounded-control bg-fill px-2 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {text(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
