import { isStateTarget, resolveStyle, type StackingMove } from "@lintel/builder-model";
import { BringToFront, ChevronDown, ChevronUp, SendToBack } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { PanelSection } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { GridPlaceControls, gridPlaceSummary, selfAlignments } from "./GridPlaceControls.js";
import { useStyleEditing, useStyleReader } from "./style-field.js";
import { StyleSelect, StyleTextInput } from "./StyleInputs.js";

/**
 * Where the selected element sits inside the one around it: its place on a placed grid or in
 * a free layout, with stacking, and, in Advanced, its place in a CSS grid set by hand. Shown
 * only when one of those applies. How a container arranges what's inside it is Layout's
 * (`LayoutSection.tsx`).
 */
export function ArrangeSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const read = useStyleReader();
  const { target } = useStyleEditing();
  const { parent } = tools;
  const isFreeChild = parent?.freeLayout !== undefined;
  const isPlacedChild = parent?.placedGrid !== undefined;
  const parentTarget = isStateTarget(target) ? "base" : target;
  const isGridChild =
    parent && !isPlacedChild
      ? resolveStyle(parent.styles, parentTarget, "display").value === "grid"
      : false;
  const showsGrid = advanced && isGridChild;
  if (!isFreeChild && !isPlacedChild && !showsGrid) return null;

  const summary = isPlacedChild
    ? gridPlaceSummary(read("gridColumn"), text)
    : isFreeChild
      ? [read("left"), read("top")].filter(Boolean).join(", ")
      : "";

  return (
    <PanelSection
      title={text("pageBuilder.design.whereItSits")}
      sectionId="arrange"
      summary={summary}
    >
      {isFreeChild && <FreePlace advanced={advanced} />}
      {isPlacedChild && (
        <>
          <GridPlaceControls advanced={advanced} />
          <StackingButtons />
        </>
      )}
      {showsGrid && (
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
    </PanelSection>
  );
}

/** An element's place in its free layout, and the buttons that stack it. */
function FreePlace({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
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
      <StackingButtons />
    </div>
  );
}

/** Bring to the front, forward, back and to the back, for elements that overlap. */
function StackingButtons() {
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
  );
}
