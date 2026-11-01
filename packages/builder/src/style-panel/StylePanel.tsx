import type {
  AnyComponentDefinition,
  Breakpoint,
  PageNode,
  StylePropertyName,
  StyleState,
  StyleTarget,
} from "@lintel/builder-model";
import { type ReactNode, useId, useMemo } from "react";
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
export type StateChoice = "none" | StyleState;

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
 * property. Changes apply at the screen size chosen in the toolbar (and smaller), or, in
 * Advanced, while the pointer is over the element or it has keyboard focus.
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
}: StylePanelProps) {
  const text = useBuilderText();
  const advanced = allowsAdvanced && mode === "advanced";
  const target: StyleTarget = advanced && state !== "none" ? state : breakpoint;
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
        {advanced && <StateSelect value={state} onChange={onStateChange} />}
        <p className="text-caption text-label-secondary">
          {target === "hover" || target === "focus"
            ? text("pageBuilder.style.editingState")
            : text(breakpointNotes[breakpoint])}
        </p>
        {isLocked && (
          <p className="text-caption text-warning">{text("pageBuilder.style.lockedNote")}</p>
        )}
      </div>
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
    </div>
  );
}

/** "Style for": always, while the pointer is over it, or while it has keyboard focus. */
function StateSelect({
  value,
  onChange,
}: {
  value: StateChoice;
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
        <option value="hover">{text("pageBuilder.style.stateHover")}</option>
        <option value="focus">{text("pageBuilder.style.stateFocus")}</option>
      </select>
    </div>
  );
}
