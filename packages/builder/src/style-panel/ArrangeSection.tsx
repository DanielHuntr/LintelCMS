import {
  canUseFreeLayout,
  isStateTarget,
  resolveStyle,
  type StackingMove,
} from "@lintel/builder-model";
import {
  BringToFront,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Move,
  Rows3,
  SendToBack,
} from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup, PanelSection } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import {
  GridPlaceControls,
  GridSettings,
  gridPlaceSummary,
  selfAlignments,
} from "./GridPlaceControls.js";
import { useStyleEditing, useStyleReader } from "./style-field.js";
import { StyleSelect, StyleTextInput } from "./StyleInputs.js";

type Placing = "order" | "grid" | "free";

/**
 * Where things go: how a section places what's inside it (in order, on a grid, or anywhere),
 * an element's place on its grid or in its free layout, with stacking, and, in Advanced, an
 * element's place in a CSS grid set by hand. Shown only when one of those applies.
 */
export function ArrangeSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const read = useStyleReader();
  const { target } = useStyleEditing();
  const { node, parent } = tools;
  const isFreeContainer = canUseFreeLayout(node);
  const isFreeChild = parent?.freeLayout !== undefined;
  const isPlacedChild = parent?.placedGrid !== undefined;
  const parentTarget = isStateTarget(target) ? "base" : target;
  const isGridChild =
    parent && !isPlacedChild
      ? resolveStyle(parent.styles, parentTarget, "display").value === "grid"
      : false;
  const isGrid = read("display") === "grid" && !node.placedGrid;
  const showsGrid = advanced && (isGridChild || isGrid);
  if (!isFreeContainer && !isFreeChild && !isPlacedChild && !showsGrid) return null;

  const summary = node.placedGrid
    ? text("pageBuilder.grid.summary", { count: node.placedGrid.columns })
    : node.freeLayout
      ? text("pageBuilder.design.freeLayout")
      : isPlacedChild
        ? gridPlaceSummary(read("gridColumn"), text)
        : isFreeChild
          ? [read("left"), read("top")].filter(Boolean).join(", ")
          : "";

  return (
    <PanelSection title={text("pageBuilder.design.arrange")} sectionId="arrange" summary={summary}>
      {isFreeContainer && <PlaceThings />}
      {isFreeChild && <FreePlace advanced={advanced} />}
      {isPlacedChild && (
        <>
          <GridPlaceControls advanced={advanced} />
          <StackingButtons />
        </>
      )}
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

/** How a section places what's inside it: in order, on a grid, or anywhere. */
function PlaceThings() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const { node } = tools;
  const placing: Placing = node.placedGrid ? "grid" : node.freeLayout ? "free" : "order";
  const choose = (next: Placing) => {
    if (next === placing) return;
    if (next === "grid") tools.setPlacedGrid({ columns: 12, stackOnPhone: true });
    else if (next === "free") tools.setFreeLayout({ stackOnPhone: true });
    else if (placing === "grid") tools.setPlacedGrid(null);
    else tools.setFreeLayout(null);
  };
  const freeLayout = node.freeLayout;
  return (
    <div className="flex flex-col gap-3">
      <ChoiceGroup<Placing>
        label={text("pageBuilder.grid.placeThings")}
        value={placing}
        onChange={choose}
        choices={[
          { value: "order", label: text("pageBuilder.grid.inOrder"), icon: Rows3 },
          { value: "grid", label: text("pageBuilder.grid.onGrid"), icon: LayoutDashboard },
          { value: "free", label: text("pageBuilder.grid.anywhere"), icon: Move },
        ]}
      />
      {node.placedGrid && <GridSettings />}
      {freeLayout && (
        <>
          <p className="text-caption text-label-tertiary">
            {text("pageBuilder.design.freeLayoutHint")}
          </p>
          <label className="flex items-center gap-2 text-footnote text-label">
            <input
              type="checkbox"
              checked={freeLayout.stackOnPhone}
              onChange={(event) => tools.setFreeLayout({ stackOnPhone: event.target.checked })}
              className="size-4 accent-[var(--color-accent-fill)]"
            />
            {text("pageBuilder.design.stackOnPhone")}
          </label>
        </>
      )}
    </div>
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
