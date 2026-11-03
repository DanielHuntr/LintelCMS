import type { LucideIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";
import { classNames } from "./classNames.js";
import { CollapsibleSection, useOpenSections } from "./CollapsibleSection.js";

/**
 * The small controls the builder's panels are made of. They use the admin's design tokens
 * (`bg-fill`, `text-label`...), so the builder looks like the rest of the admin in light and
 * dark mode. Every control has a visible or spoken label and works from the keyboard.
 */

export const inputClassName =
  "h-8 w-full min-w-0 rounded-control bg-fill px-2 text-footnote text-label placeholder:text-label-tertiary focus-visible:focus-ring";

export { classNames };

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  /** Shown as the tooltip; defaults to the label. */
  hint?: string;
  size?: "small" | "regular";
  tabIndex?: number;
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  pressed,
  hint,
  size = "regular",
  tabIndex,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint ?? label}
      aria-pressed={pressed}
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={onClick}
      className={classNames(
        "flex shrink-0 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 hover:bg-fill hover:text-label focus-visible:focus-ring disabled:opacity-40 disabled:hover:bg-transparent",
        size === "small" ? "size-6" : "size-8",
        pressed && "bg-fill text-accent",
      )}
    >
      <Icon aria-hidden="true" className={size === "small" ? "size-3.5" : "size-4"} />
    </button>
  );
}

export interface Choice<Value extends string> {
  value: Value;
  label: string;
  icon?: LucideIcon;
}

interface ChoiceGroupProps<Value extends string> {
  label: string;
  choices: readonly Choice<Value>[];
  value: Value | undefined;
  onChange: (value: Value) => void;
  /** Show only icons, with the label as each one's name. */
  iconsOnly?: boolean;
  hideLabel?: boolean;
  /** Let the choices run onto a second row when they don't fit, rather than squeeze. */
  wraps?: boolean;
  /** One choice per row, for longer labels such as names. */
  stacked?: boolean;
}

/** A row of exclusive choices: a radio group where the arrow keys move the choice. */
export function ChoiceGroup<Value extends string>({
  label,
  choices,
  value,
  onChange,
  iconsOnly,
  hideLabel,
  wraps,
  stacked,
}: ChoiceGroupProps<Value>) {
  const labelId = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = choices.findIndex((choice) => choice.value === value);

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + choices.length) % choices.length;
    onChange((choices[next] as Choice<Value>).value);
    buttons.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className={hideLabel ? "sr-only" : "text-caption text-label-secondary"}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={classNames(
          "flex rounded-control bg-fill p-0.5",
          wraps && "flex-wrap",
          stacked && "flex-col",
        )}
      >
        {choices.map((choice, index) => {
          const isSelected = choice.value === value;
          const Icon = choice.icon;
          return (
            <button
              key={choice.value}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={iconsOnly ? choice.label : undefined}
              title={iconsOnly ? choice.label : undefined}
              tabIndex={isSelected || (selectedIndex === -1 && index === 0) ? 0 : -1}
              onClick={() => onChange(choice.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={classNames(
                "flex h-7 min-w-0 flex-1 items-center gap-1 rounded-[6px] px-1.5 text-caption font-medium transition-colors duration-150 focus-visible:focus-ring",
                stacked ? "flex-none justify-start px-2.5" : "justify-center",
                wraps && "basis-[30%]",
                isSelected
                  ? "bg-segment text-label shadow-thumb"
                  : "text-label-secondary hover:text-label",
              )}
            >
              {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
              {!iconsOnly && <span className="truncate">{choice.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface LabelledProps {
  label: string;
  children: (id: string) => ReactNode;
  /** A dot and a note when the value is changed for this screen size or state. */
  overridden?: string;
  onReset?: () => void;
  resetLabel?: string;
  hint?: string;
}

/** A label above a control, with the "changed here" dot and a way to reset it. */
export function Labelled({
  label,
  children,
  overridden,
  onReset,
  resetLabel,
  hint,
}: LabelledProps) {
  const id = useId();
  return (
    // Long labels wrap rather than being cut off; side by side, the controls still line up.
    <div className="flex min-w-0 flex-col justify-end gap-1">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="min-w-0 text-caption text-pretty text-label-secondary">
          {label}
        </label>
        {overridden && (
          <>
            <span
              className="size-1.5 shrink-0 rounded-full bg-accent-fill"
              aria-hidden="true"
              title={overridden}
            />
            <span className="sr-only">{overridden}</span>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="ms-auto rounded px-1 text-caption text-accent hover:underline focus-visible:focus-ring"
              >
                {resetLabel}
              </button>
            )}
          </>
        )}
      </div>
      {children(id)}
      {hint && <p className="text-caption text-label-tertiary">{hint}</p>}
    </div>
  );
}

interface PanelSectionProps {
  title: string;
  children: ReactNode;
  /**
   * Names the section in a panel with collapsible sections (see `OpenSectionsContext`), so
   * it can be opened, closed and remembered. Without one it is always open.
   */
  sectionId?: string;
  /** What's set inside, shown while the section is closed. */
  summary?: string;
}

/** A titled group of controls in a panel, collapsible when the panel says so. */
export function PanelSection({ title, children, sectionId, summary }: PanelSectionProps) {
  const headingId = useId();
  const openSections = useOpenSections();
  if (openSections && sectionId) {
    return (
      <CollapsibleSection
        title={title}
        summary={summary}
        isOpen={openSections.isOpen(sectionId)}
        onToggle={() => openSections.toggle(sectionId)}
        onUse={() => openSections.markUsed(sectionId)}
        isContentDisabled={openSections.isContentDisabled}
      >
        {children}
      </CollapsibleSection>
    );
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 hairline-bottom px-4 py-4">
      <h3 id={headingId} className="text-footnote font-semibold text-label">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface TabsProps<Value extends string> {
  label: string;
  tabs: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
  idPrefix: string;
}

/** Panel tabs (the ARIA tabs pattern): arrow keys move between them. */
export function Tabs<Value extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
}: TabsProps<Value>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex shrink-0 gap-1 hairline-bottom px-3 py-2"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          id={`${idPrefix}-tab-${tab.value}`}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={tab.value === value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => {
            const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (step === 0) return;
            event.preventDefault();
            const next = (index + step + tabs.length) % tabs.length;
            onChange((tabs[next] as { value: Value }).value);
            buttons.current[next]?.focus();
          }}
          className={classNames(
            "rounded-control px-2.5 py-1 text-footnote font-medium transition-colors duration-150 focus-visible:focus-ring",
            tab.value === value ? "bg-fill text-label" : "text-label-secondary hover:text-label",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
