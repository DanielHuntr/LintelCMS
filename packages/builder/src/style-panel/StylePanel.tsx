import {
  type AnyComponentDefinition,
  type Breakpoint,
  type OwnerStateTarget,
  type PageNode,
  readOwnerStateTarget,
  type StateTransition,
  type StylePropertyName,
  type StyleState,
  type StyleTarget,
} from "@lintel/builder-model";
import { type ReactNode, useId, useMemo } from "react";
import { CanvasLookContext, useCanvasLook } from "./canvas-look.js";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { usePreferenceStore } from "../preferences/builder-preferences.js";
import {
  useLastUsedOpenSections,
  useRememberedOpenSections,
} from "../preferences/open-sections.js";
import { OpenSectionsContext } from "../ui/CollapsibleSection.js";
import { ChoiceGroup, inputClassName } from "../ui/controls.js";
import { ArrangeSection } from "./ArrangeSection.js";
import { BackgroundSection } from "./BackgroundSection.js";
import { type DesignTools, DesignToolsContext } from "./design-tools.js";
import { FiltersSection } from "./FiltersSection.js";
import { ShapeSection } from "./ShapeSection.js";
import { TransformSection } from "./TransformSection.js";
import {
  BordersSection,
  EffectsSection,
  PositionSection,
  SizeSection,
} from "./AppearanceSections.js";
import { LayoutSection } from "./LayoutSection.js";
import { SpacingSection } from "./SpacingSection.js";
import { type StyleEditing, StyleEditingContext } from "./style-field.js";
import { TypographySection } from "./TypographySection.js";

export type StylePanelMode = "simple" | "advanced";
export type StateChoice = "none" | StyleState | OwnerStateTarget;

/** An element around the selected one whose states it can follow, nearest first. */
export interface StateOwner {
  id: string;
  name: string;
  stateTransition?: StateTransition;
}

interface StylePanelProps {
  node: PageNode;
  definition: AnyComponentDefinition | undefined;
  breakpoint: Breakpoint;
  mode: StylePanelMode;
  onModeChange: (mode: StylePanelMode) => void;
  state: StateChoice;
  onStateChange: (state: StateChoice) => void;
  isLocked: boolean;
  /** False for beginners: only the simple choices, and no Simple/Advanced switch. */
  allowsAdvanced?: boolean;
  /** Shown to beginners above the styles, such as a tip about more control. */
  note?: ReactNode;
  onChange: (
    target: StyleTarget,
    values: Partial<Record<StylePropertyName, string | undefined>>,
    label: string,
  ) => void;
  /** Settings beyond styles: free layout, background video, the page's fonts, stacking. */
  design: DesignTools;
  /** The elements around this one, whose states it can follow ("while the card is hovered"). */
  owners?: readonly StateOwner[];
  /** Sets how an element, and what follows its states, moves between them. */
  onTransitionChange?: (nodeId: string, transition: StateTransition | null) => void;
}

const textTypes = new Set(["heading", "text", "quote", "list", "button", "link", "navigation"]);

/** What a beginner sees open the first time: the groups people change most. */
const simpleOpenAtFirst = ["layout", "spacing", "text"];

const breakpointNotes: Record<Breakpoint, BuilderStringKey> = {
  base: "pageBuilder.style.editingDesktop",
  tablet: "pageBuilder.style.editingTablet",
  phone: "pageBuilder.style.editingPhone",
};

/**
 * How the selected element looks. Simple shows a few friendly choices; Advanced shows every
 * property. Changes apply at the screen size chosen in the toolbar (and smaller), or in a
 * state: while the pointer is over the element, while it's pressed, while it has keyboard
 * focus, or while an element around it (a card, say) is hovered or pressed, so they move
 * together. Choosing a state shows it on the page, and "Moving between states" sets how it
 * eases in and out.
 */
export function StylePanel({
  node,
  definition,
  breakpoint,
  mode,
  onModeChange,
  state,
  onStateChange,
  isLocked,
  allowsAdvanced = true,
  note,
  onChange,
  design,
  owners = [],
  onTransitionChange,
}: StylePanelProps) {
  const text = useBuilderText();
  const advanced = allowsAdvanced && mode === "advanced";
  // An owner's state only counts while that owner is still around the selected element.
  const ownerTarget = readOwnerStateTarget(state === "none" ? "base" : state);
  const owner = ownerTarget
    ? owners.find((candidate) => candidate.id === ownerTarget.ownerId)
    : undefined;
  const validState: StateChoice = ownerTarget && !owner ? "none" : state;
  const target: StyleTarget = validState !== "none" ? validState : breakpoint;
  const editing = useMemo<StyleEditing>(
    () => ({
      styles: node.styles,
      target,
      change: (values, label) => onChange(target, values, label),
    }),
    [node.styles, target, onChange],
  );
  const store = usePreferenceStore();
  const simpleSections = useRememberedOpenSections(store, "style.simple.open", simpleOpenAtFirst);
  const advancedSections = useLastUsedOpenSections(store, "style.advanced.lastUsed");
  const sections = advanced ? advancedSections : simpleSections;
  const openSections = useMemo(
    () => ({ ...sections, isContentDisabled: isLocked }),
    [sections, isLocked],
  );
  const holdsElements = definition?.allowedChildren !== "none";
  // Only this element's measured look goes on to the sections, never another's.
  const look = useCanvasLook(node.id);
  const showsText = advanced || textTypes.has(node.type) || holdsElements;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 hairline-bottom px-4 py-3">
        {allowsAdvanced ? (
          <ChoiceGroup<StylePanelMode>
            label={text("pageBuilder.style.modeLabel")}
            hideLabel
            value={mode}
            onChange={onModeChange}
            choices={[
              { value: "simple", label: text("pageBuilder.style.simple") },
              { value: "advanced", label: text("pageBuilder.style.advanced") },
            ]}
          />
        ) : (
          note
        )}
        <StateSelect value={validState} owners={owners} onChange={onStateChange} />
        <p className="text-caption text-label-secondary">
          {owner
            ? text("pageBuilder.style.editingOwnerState", { name: owner.name })
            : validState !== "none"
              ? text("pageBuilder.style.editingState")
              : text(breakpointNotes[breakpoint])}
        </p>
        {validState !== "none" && onTransitionChange && (
          <TransitionControls
            owner={
              owner ?? {
                id: node.id,
                name: text("pageBuilder.style.stateOwnHeading"),
                stateTransition: node.stateTransition,
              }
            }
            onChange={onTransitionChange}
          />
        )}
        {isLocked && (
          <p className="text-caption text-warning">{text("pageBuilder.style.lockedNote")}</p>
        )}
      </div>
      <CanvasLookContext value={look}>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">{text("pageBuilder.style.legend")}</legend>
          <OpenSectionsContext.Provider value={openSections}>
            <StyleEditingContext.Provider value={editing}>
              <DesignToolsContext.Provider value={design}>
                <ArrangeSection advanced={advanced} />
                {holdsElements && <LayoutSection advanced={advanced} />}
                <SpacingSection advanced={advanced} />
                {advanced && <SizeSection />}
                {showsText && <TypographySection advanced={advanced} />}
                <BackgroundSection advanced={advanced} />
                <BordersSection advanced={advanced} />
                <TransformSection advanced={advanced} />
                <ShapeSection advanced={advanced} />
                {advanced && <PositionSection />}
                {advanced && <EffectsSection />}
                <FiltersSection advanced={advanced} />
              </DesignToolsContext.Provider>
            </StyleEditingContext.Provider>
          </OpenSectionsContext.Provider>
        </fieldset>
      </CanvasLookContext>
    </div>
  );
}

/**
 * "Style for": always, one of its own states, or a state of an element around it. The list
 * is short: its own three states, then the nearest few elements around it.
 */
function StateSelect({
  value,
  owners,
  onChange,
}: {
  value: StateChoice;
  owners: readonly StateOwner[];
  onChange: (state: StateChoice) => void;
}) {
  const text = useBuilderText();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-caption text-label-secondary">
        {text("pageBuilder.style.stateLabel")}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as StateChoice)}
        className={inputClassName}
      >
        <option value="none">{text("pageBuilder.style.stateNone")}</option>
        <optgroup label={text("pageBuilder.style.stateOwnHeading")}>
          <option value="hover">{text("pageBuilder.style.stateHover")}</option>
          <option value="pressed">{text("pageBuilder.style.statePressed")}</option>
          <option value="focus">{text("pageBuilder.style.stateFocus")}</option>
        </optgroup>
        {owners.length > 0 && (
          <optgroup label={text("pageBuilder.style.stateOwnerHeading")}>
            {owners.flatMap((owner) => [
              <option key={`hover@${owner.id}`} value={`hover@${owner.id}`}>
                {text("pageBuilder.style.stateOwnerHover", { name: owner.name })}
              </option>,
              <option key={`pressed@${owner.id}`} value={`pressed@${owner.id}`}>
                {text("pageBuilder.style.stateOwnerPressed", { name: owner.name })}
              </option>,
            ])}
          </optgroup>
        )}
      </select>
    </div>
  );
}

const defaultTransition: StateTransition = { feel: "smooth", speed: "steady" };

/**
 * How the element whose state is being styled (the selected one, or the card around it) eases
 * into and out of its states, with everything that follows them. "Instant" leaves it off.
 */
function TransitionControls({
  owner,
  onChange,
}: {
  owner: StateOwner;
  onChange: (nodeId: string, transition: StateTransition | null) => void;
}) {
  const text = useBuilderText();
  const current = owner.stateTransition;
  const feel = current?.feel ?? "instant";
  return (
    <div className="flex flex-col gap-2 rounded-card bg-fill/60 p-2.5">
      <p className="text-caption font-semibold text-label">
        {text("pageBuilder.style.transitionLabel")}
      </p>
      <ChoiceGroup<StateTransition["feel"]>
        label={text("pageBuilder.style.transitionFeel")}
        value={feel}
        onChange={(next) =>
          onChange(
            owner.id,
            next === "instant" ? null : { ...(current ?? defaultTransition), feel: next },
          )
        }
        choices={[
          { value: "smooth", label: text("pageBuilder.style.feelSmooth") },
          { value: "springy", label: text("pageBuilder.style.feelSpringy") },
          { value: "instant", label: text("pageBuilder.style.feelInstant") },
        ]}
      />
      {current && (
        <ChoiceGroup<StateTransition["speed"]>
          label={text("pageBuilder.style.transitionSpeed")}
          value={current.speed}
          onChange={(speed) => onChange(owner.id, { ...current, speed })}
          choices={[
            { value: "quick", label: text("pageBuilder.style.speedQuick") },
            { value: "steady", label: text("pageBuilder.style.speedSteady") },
            { value: "slow", label: text("pageBuilder.style.speedSlow") },
          ]}
        />
      )}
      <p className="text-caption text-label-secondary">
        {text("pageBuilder.style.transitionFor", { name: owner.name })}
      </p>
    </div>
  );
}
