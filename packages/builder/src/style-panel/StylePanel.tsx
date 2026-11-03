import {
  type AnyComponentDefinition,
  type Breakpoint,
  isOwnerStateTarget,
  layerStyles,
  type OwnerStateTarget,
  type PageNode,
  readOwnerStateTarget,
  setStyles,
  type StateTransition,
  type StylePropertyName,
  type StyleState,
  type StyleTarget,
} from "@lintel/builder-model";
import { type ReactNode, useMemo, useState } from "react";
import { type SharedScope, SharedStyleBar } from "../site-design/SharedStyleBar.js";
import { useSiteDesign, withSharedStyle } from "../site-design/site-design-context.js";
import { CanvasLookContext, useCanvasLook } from "./canvas-look.js";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { usePreferenceStore } from "../preferences/builder-preferences.js";
import {
  useLastUsedOpenSections,
  useRememberedOpenSections,
} from "../preferences/open-sections.js";
import { OpenSectionsContext } from "../ui/CollapsibleSection.js";
import { ChoiceGroup } from "../ui/controls.js";
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
  /** How many elements on this page use each shared style. */
  sharedStyleUses?: ReadonlyMap<string, number>;
  /** The element's name in Layers, offered as the name of a shared style made from it. */
  nodeName?: string;
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
  sharedStyleUses,
  nodeName = "",
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
  // With a shared style, changes go to it (every element that uses it) unless "Only this
  // one" is chosen; styles that follow another element's state are always this one's own.
  const site = useSiteDesign();
  const changeSite = site.change;
  const shared = node.sharedStyle
    ? site.design.sharedStyles.find((each) => each.id === node.sharedStyle)
    : undefined;
  const [scope, setScope] = useState<{ nodeId: string; scope: SharedScope }>({
    nodeId: node.id,
    scope: "every",
  });
  const sharedScope = scope.nodeId === node.id ? scope.scope : "every";
  const editsShared =
    shared !== undefined &&
    changeSite !== undefined &&
    sharedScope === "every" &&
    !isOwnerStateTarget(target);
  const editing = useMemo<StyleEditing>(() => {
    if (shared && editsShared && changeSite) {
      return {
        styles: shared.styles,
        target,
        change: (values) => {
          const styles = setStyles(shared.styles, target, values);
          delete styles.owners;
          changeSite(withSharedStyle(site.design, { ...shared, styles }));
        },
      };
    }
    return {
      styles: shared ? layerStyles(shared.styles, node.styles) : node.styles,
      target,
      change: (values, label) => onChange(target, values, label),
    };
  }, [shared, editsShared, changeSite, site.design, node.styles, target, onChange]);
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
        <SharedStyleBar
          node={node}
          design={design}
          uses={node.sharedStyle ? (sharedStyleUses?.get(node.sharedStyle) ?? 1) : 0}
          scope={sharedScope}
          onScopeChange={(next) => setScope({ nodeId: node.id, scope: next })}
          defaultName={nodeName}
          isLocked={isLocked}
        />
        <LookPicker value={validState} owners={owners} onChange={onStateChange} />
        {validState === "none" && (
          <p className="text-caption text-label-secondary">{text(breakpointNotes[breakpoint])}</p>
        )}
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

/** The looks an element can have, in the order they're offered. */
const lookChoices: ReadonlyArray<{ value: "none" | StyleState; label: BuilderStringKey }> = [
  { value: "none", label: "pageBuilder.style.lookNormal" },
  { value: "hover", label: "pageBuilder.style.lookHover" },
  { value: "pressed", label: "pageBuilder.style.lookPressed" },
  { value: "focus", label: "pageBuilder.style.lookFocus" },
  { value: "open", label: "pageBuilder.style.lookOpen" },
  { value: "selected", label: "pageBuilder.style.lookSelected" },
];

/** What each look means, in a sentence, for this element or one around it. */
const lookMeanings: Record<StyleState, BuilderStringKey> = {
  hover: "pageBuilder.style.meansHover",
  pressed: "pageBuilder.style.meansPressed",
  focus: "pageBuilder.style.meansFocus",
  open: "pageBuilder.style.meansOpen",
  selected: "pageBuilder.style.meansSelected",
};
const ownerLookMeanings: Record<StyleState, BuilderStringKey> = {
  hover: "pageBuilder.style.ownerMeansHover",
  pressed: "pageBuilder.style.ownerMeansPressed",
  focus: "pageBuilder.style.ownerMeansHover",
  open: "pageBuilder.style.ownerMeansOpen",
  selected: "pageBuilder.style.ownerMeansSelected",
};

/** Keyboard focus is the element's own: something around it can't follow it. */
const followableStates = new Set<StyleState>(["hover", "pressed", "open", "selected"]);

/**
 * Which look is being changed: the normal one, or how it looks while hovered, pressed and so
 * on. For those, a second question says whose state it is: this element's own, or one around
 * it ("the picture grows while its card is hovered").
 */
function LookPicker({
  value,
  owners,
  onChange,
}: {
  value: StateChoice;
  owners: readonly StateOwner[];
  onChange: (state: StateChoice) => void;
}) {
  const text = useBuilderText();
  const ownerTarget = readOwnerStateTarget(value === "none" ? "base" : value);
  const look: "none" | StyleState = ownerTarget
    ? ownerTarget.state
    : (value as "none" | StyleState);
  const ownerId = ownerTarget?.ownerId;
  const canFollow = look !== "none" && followableStates.has(look) && owners.length > 0;
  const owner = owners.find((candidate) => candidate.id === ownerId);

  function chooseLook(next: "none" | StyleState) {
    // Keep following the same element around it when the new look allows it.
    if (next !== "none" && ownerId && followableStates.has(next)) {
      onChange(`${next}@${ownerId}`);
    } else {
      onChange(next);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ChoiceGroup<"none" | StyleState>
        label={text("pageBuilder.style.lookLabel")}
        value={look}
        onChange={chooseLook}
        wraps
        choices={lookChoices.map((choice) => ({
          value: choice.value,
          label: text(choice.label),
        }))}
      />
      {canFollow && (
        <ChoiceGroup<string>
          label={text("pageBuilder.style.whoseLabel", {
            look: text(lookChoices.find((choice) => choice.value === look)!.label).toLowerCase(),
          })}
          value={ownerId ?? "self"}
          onChange={(next) => onChange(next === "self" ? look : `${look}@${next}`)}
          stacked
          choices={[
            { value: "self", label: text("pageBuilder.style.whoseSelf") },
            ...owners.map((candidate) => ({
              value: candidate.id,
              label: text("pageBuilder.style.whoseOwner", { name: candidate.name }),
            })),
          ]}
        />
      )}
      {look !== "none" && (
        <p
          className="rounded-control bg-accent/10 px-3 py-2 text-caption text-label"
          aria-live="polite"
        >
          {owner ? text(ownerLookMeanings[look], { name: owner.name }) : text(lookMeanings[look])}
        </p>
      )}
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
