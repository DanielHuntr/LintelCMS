import { Check, type LucideIcon } from "lucide-react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { classNames } from "./classNames.js";
import { radioGroupTargetIndex } from "./radioGroupKeys.js";

export interface ChoiceCard<Value extends string> {
  value: Value;
  title: string;
  /** One line under the title. */
  description: string;
  icon: LucideIcon;
  /** Something small beside the title, such as a "Recommended" Badge. */
  accessory?: ReactNode;
}

interface ChoiceCardGroupProps<Value extends string> {
  /** Read by screen readers to say what the choice is about. */
  label?: string;
  /** The id of a visible heading that names the choice, used instead of `label`. */
  labelledBy?: string;
  options: readonly ChoiceCard<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /**
   * Called when a tile is clicked, or pressed with Enter or Space, but not when the arrow
   * keys move the choice. Screens use it to move on as soon as someone picks.
   */
  onActivate?: (value: Value) => void;
  /** Tiles per row on wide screens. On phones they always stack. */
  columns?: 2 | 3;
}

const columnClasses = {
  2: "sm:basis-[calc((100%-1rem)/2)]",
  3: "sm:basis-[calc((100%-2rem)/3)]",
};

/**
 * Large tiles for a choice that deserves an icon and a sentence, such as what someone is
 * building. Like SegmentedControl it is a radio group: one tab stop, and arrow keys move.
 */
export function ChoiceCardGroup<Value extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  onActivate,
  columns = 2,
}: ChoiceCardGroupProps<Value>) {
  const groupId = useId();
  const tileElements = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const targetIndex = radioGroupTargetIndex(event.key, index, options.length);
    const target = targetIndex === undefined ? undefined : options[targetIndex];
    if (targetIndex === undefined || !target) return;
    event.preventDefault();
    onChange(target.value);
    tileElements.current[targetIndex]?.focus();
  }

  function handleClick(chosen: Value) {
    onChange(chosen);
    onActivate?.(chosen);
  }

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const titleId = `${groupId}-${option.value}-title`;
        const descriptionId = `${groupId}-${option.value}-description`;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            ref={(element) => {
              tileElements.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => handleClick(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={classNames(
              "relative flex items-center gap-4 rounded-panel p-4 text-start",
              "sm:min-h-[184px] sm:flex-col sm:items-start sm:justify-start sm:gap-5 sm:p-5",
              "transition duration-200 ease-standard focus-visible:focus-ring",
              "motion-safe:active:scale-[0.98]",
              columnClasses[columns],
              isSelected
                ? "bg-accent/8 ring-2 ring-accent"
                : "bg-surface ring-1 ring-separator hover:ring-label-tertiary",
            )}
          >
            <span
              className={classNames(
                "flex size-12 shrink-0 items-center justify-center rounded-card",
                "transition-colors duration-200 ease-standard",
                isSelected ? "bg-accent-fill text-on-accent" : "bg-accent/10 text-accent",
              )}
            >
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-7" />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-1 pe-7 sm:flex-none sm:pe-0">
              <span className="flex flex-wrap items-center gap-2">
                <span id={titleId} className="text-headline text-label">
                  {option.title}
                </span>
                {option.accessory}
              </span>
              <span id={descriptionId} className="text-footnote text-label-secondary">
                {option.description}
              </span>
            </span>

            <SelectedMark isSelected={isSelected} />
          </button>
        );
      })}
    </div>
  );
}

/** A check in the tile's corner once it's chosen; an empty ring before. */
function SelectedMark({ isSelected }: { isSelected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "absolute top-1/2 inset-e-4 flex size-6 -translate-y-1/2 items-center justify-center rounded-full",
        "sm:top-4 sm:translate-y-0",
        "transition duration-200 ease-standard",
        isSelected ? "bg-accent-fill text-on-accent" : "border-[1.5px] border-separator",
      )}
    >
      {isSelected && <Check strokeWidth={3} className="size-3.5" />}
    </span>
  );
}
