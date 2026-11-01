import type {
  AnyComponentDefinition,
  Breakpoint,
  PageNode,
  StylePropertyName,
  StyleState,
  StyleTarget,
} from "@lintel/builder-model";
import { useMemo } from "react";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup } from "../ui/controls.js";
import {
  BackgroundSection,
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
  onChange: (
    target: StyleTarget,
    values: Partial<Record<StylePropertyName, string | undefined>>,
    label: string,
  ) => void;
}

const textTypes = new Set(["heading", "text", "quote", "list", "button", "link", "navigation"]);

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
  onChange,
}: StylePanelProps) {
  const text = useBuilderText();
  const advanced = mode === "advanced";
  const target: StyleTarget = advanced && state !== "none" ? state : breakpoint;
  const editing = useMemo<StyleEditing>(
    () => ({
      styles: node.styles,
      target,
      change: (values, label) => onChange(target, values, label),
    }),
    [node.styles, target, onChange],
  );
  const holdsElements = definition?.allowedChildren !== "none";
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
        {advanced && (
          <ChoiceGroup<StateChoice>
            label={text("pageBuilder.style.stateLabel")}
            value={state}
            onChange={onStateChange}
            choices={[
              { value: "none", label: text("pageBuilder.style.stateNone") },
              { value: "hover", label: text("pageBuilder.style.stateHover") },
              { value: "focus", label: text("pageBuilder.style.stateFocus") },
            ]}
          />
        )}
        <p className="text-caption text-label-secondary">
          {target === "hover" || target === "focus"
            ? text("pageBuilder.style.editingState")
            : text(breakpointNotes[breakpoint])}
        </p>
        {isLocked && (
          <p className="text-caption text-warning">{text("pageBuilder.style.lockedNote")}</p>
        )}
      </div>
      <fieldset disabled={isLocked} className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">{text("pageBuilder.style.legend")}</legend>
        <StyleEditingContext.Provider value={editing}>
          {holdsElements && <LayoutSection advanced={advanced} />}
          <SpacingSection advanced={advanced} />
          {advanced && <SizeSection />}
          {showsText && <TypographySection advanced={advanced} />}
          <BackgroundSection />
          <BordersSection advanced={advanced} />
          {advanced && <PositionSection />}
          {advanced && <EffectsSection />}
        </StyleEditingContext.Provider>
      </fieldset>
    </div>
  );
}
