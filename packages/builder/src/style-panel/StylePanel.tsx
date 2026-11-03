import {
  type AnyComponentDefinition,
  type Breakpoint,
  isOwnerStateTarget,
  layerStyles,
  placeProperties,
  type OwnerStateTarget,
  type PageNode,
  readOwnerStateTarget,
  setStyles,
  sharedStylesById,
  type StateTransition,
  type StylePropertyName,
  type StyleState,
  type StyleTarget,
} from "@lintel/builder-model";
import { ChevronRight, Palette } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { type SharedScope, SharedStyleBar } from "../site-design/SharedStyleBar.js";
import { useSiteDesign, withSharedStyle } from "../site-design/site-design-context.js";
import { CanvasLookContext, useCanvasLook } from "./canvas-look.js";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { type RelevantLooks } from "./relevant-looks.js";
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
  /** Where it is ("2 levels up"), when another element around has the same name. */
  place?: string;
  stateTransition?: StateTransition;
}

/** An owner's name, told apart from another with the same name: "Container (2 levels up)". */
function ownerName(owner: StateOwner): string {
  return owner.place ? `${owner.name} (${owner.place})` : owner.name;
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
  /** Shown under the Simple/Advanced switch, such as a first-time tip. */
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
  /** Outlines an element around this one while the pointer is on its name; null clears. */
  onPointAtOwner?: (nodeId: string | null) => void;
  /** Sets how an element, and what follows its states, moves between them. */
  onTransitionChange?: (nodeId: string, transition: StateTransition | null) => void;
  /** How many elements on this page use each shared style. */
  sharedStyleUses?: ReadonlyMap<string, number>;
  /** The element's name in Layers, offered as the name of a shared style made from it. */
  nodeName?: string;
  /** Opens Site styles: the site's named colours, sizes, fonts and shared styles. */
  onOpenSiteStyles?: () => void;
  /** Whether Open and Current make sense for this element; left out, both are offered. */
  looks?: RelevantLooks;
}

const textTypes = new Set(["heading", "text", "quote", "list", "button", "link", "navigation"]);

/** What Simple shows open the first time: the groups people change most. */
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
  note,
  onChange,
  design,
  owners = [],
  onPointAtOwner,
  onTransitionChange,
  sharedStyleUses,
  nodeName = "",
  onOpenSiteStyles,
  looks,
}: StylePanelProps) {
  const text = useBuilderText();
  const advanced = mode === "advanced";
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
  // The look it has: a variant's is its base's with its own over it.
  const sharedLook = useMemo(
    () => (node.sharedStyle ? sharedStylesById(site.design)[node.sharedStyle] : undefined),
    [node.sharedStyle, site.design],
  );
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
        // What shows is the look in effect; where it sits (its place) is always its own.
        styles: layerStyles((sharedLook ?? shared).styles, node.styles),
        target,
        change: (values, label) => {
          const entries = Object.entries(values) as Array<[StylePropertyName, string | undefined]>;
          const place = entries.filter(([property]) => placeProperties.includes(property));
          const look = entries.filter(([property]) => !placeProperties.includes(property));
          if (place.length > 0) onChange(target, Object.fromEntries(place), label);
          if (look.length === 0) return;
          const styles = setStyles(shared.styles, target, Object.fromEntries(look));
          delete styles.owners;
          changeSite(withSharedStyle(site.design, { ...shared, styles }));
        },
      };
    }
    return {
      styles: sharedLook ? layerStyles(sharedLook.styles, node.styles) : node.styles,
      target,
      change: (values, label) => onChange(target, values, label),
    };
  }, [shared, sharedLook, editsShared, changeSite, site.design, node.styles, target, onChange]);
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
        {note}
        <SharedStyleBar
          node={node}
          design={design}
          uses={node.sharedStyle ? (sharedStyleUses?.get(node.sharedStyle) ?? 1) : 0}
          scope={sharedScope}
          onScopeChange={(next) => setScope({ nodeId: node.id, scope: next })}
          defaultName={nodeName}
          isLocked={isLocked}
        />
        {onOpenSiteStyles && (
          <button
            type="button"
            onClick={onOpenSiteStyles}
            className="-mx-1 flex min-h-9 items-center gap-2 rounded-control px-1 text-start hover:bg-fill/60 focus-visible:focus-ring"
          >
            <Palette aria-hidden="true" className="size-4 shrink-0 text-label-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block text-footnote font-medium text-label">
                {text("pageBuilder.siteStyles.open")}
              </span>
              <span className="block truncate text-caption text-label-tertiary">
                {text("pageBuilder.siteStyles.openHint")}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
          </button>
        )}
        <LookPicker
          value={validState}
          looks={advanced ? undefined : looks}
          owners={owners}
          onChange={onStateChange}
          onPointAtOwner={onPointAtOwner}
        />
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
  looks,
  owners,
  onChange,
  onPointAtOwner,
}: {
  value: StateChoice;
  looks?: RelevantLooks;
  owners: readonly StateOwner[];
  onChange: (state: StateChoice) => void;
  onPointAtOwner?: (nodeId: string | null) => void;
}) {
  const text = useBuilderText();
  const [isFollowing, setIsFollowing] = useState(false);
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
        choices={lookChoices
          // Open and Current only where they mean something (or are already in use).
          .filter(
            (choice) =>
              !looks ||
              choice.value === look ||
              (choice.value !== "open" && choice.value !== "selected") ||
              looks[choice.value === "open" ? "open" : "selected"],
          )
          .map((choice) => ({
            value: choice.value,
            label: text(choice.label),
          }))}
      />
      {canFollow && !ownerId && !isFollowing && (
        <button
          type="button"
          onClick={() => setIsFollowing(true)}
          className="self-start text-caption font-medium text-accent hover:underline focus-visible:focus-ring"
        >
          {text("pageBuilder.style.followSomethingAround", {
            look: text(lookChoices.find((choice) => choice.value === look)!.label).toLowerCase(),
          })}
        </button>
      )}
      {canFollow && (ownerId || isFollowing) && (
        <ChoiceGroup<string>
          label={text("pageBuilder.style.whoseLabel", {
            look: text(lookChoices.find((choice) => choice.value === look)!.label).toLowerCase(),
          })}
          value={ownerId ?? "self"}
          onChange={(next) => onChange(next === "self" ? look : `${look}@${next}`)}
          onPointAt={
            onPointAtOwner &&
            ((choice) => onPointAtOwner(choice && choice !== "self" ? choice : null))
          }
          stacked
          choices={[
            { value: "self", label: text("pageBuilder.style.whoseSelf") },
            ...owners.map((candidate) => ({
              value: candidate.id,
              label: candidate.place
                ? text("pageBuilder.style.whoseOwnerPlace", {
                    name: candidate.name,
                    place: candidate.place,
                  })
                : text("pageBuilder.style.whoseOwner", { name: candidate.name }),
            })),
          ]}
        />
      )}
      {look !== "none" && (
        <p
          className="rounded-control bg-accent/10 px-3 py-2 text-caption text-label"
          aria-live="polite"
        >
          {owner
            ? text(ownerLookMeanings[look], { name: ownerName(owner) })
            : text(lookMeanings[look])}
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
        {text("pageBuilder.style.transitionFor", { name: ownerName(owner) })}
      </p>
    </div>
  );
}
