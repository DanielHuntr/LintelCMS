import type { LucideIcon } from "lucide-react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { classNames } from "./classNames.js";
import { radioGroupTargetIndex } from "./radioGroupKeys.js";

export interface ChoiceCard<Value extends string> {
  value: Value;
  title: string;
  description: string;
  icon?: LucideIcon;
  /** Something small beside the title, such as a "Recommended" Badge. */
  accessory?: ReactNode;
}

interface ChoiceCardGroupProps<Value extends string> {
  /** Read by screen readers to say what the choice is about. */
  label: string;
  options: readonly ChoiceCard<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

/**
 * Large cards for a choice that deserves a sentence of explanation per option, such as where
 * to keep content. Like SegmentedControl it is a radio group: one tab stop, arrow keys move.
 */
export function ChoiceCardGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceCardGroupProps<Value>) {
  const groupId = useId();
  const cardElements = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const targetIndex = radioGroupTargetIndex(event.key, index, options.length);
    const target = targetIndex === undefined ? undefined : options[targetIndex];
    if (targetIndex === undefined || !target) return;
    event.preventDefault();
    onChange(target.value);
    cardElements.current[targetIndex]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-3">
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const titleId = `${groupId}-${option.value}-title`;
        const descriptionId = `${groupId}-${option.value}-description`;

        return (
          <button
            key={option.value}
            ref={(element) => {
              cardElements.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={classNames(
              "flex w-full items-start gap-3 rounded-card p-4 text-left",
              "transition duration-150 ease-standard focus-visible:focus-ring",
              isSelected
                ? "bg-accent/8 ring-2 ring-accent"
                : "bg-fill/60 ring-1 ring-separator hover:bg-fill",
            )}
          >
            {option.icon && <CardIcon icon={option.icon} isSelected={isSelected} />}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
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
            <RadioMark isSelected={isSelected} />
          </button>
        );
      })}
    </div>
  );
}

function CardIcon({ icon: Icon, isSelected }: { icon: LucideIcon; isSelected: boolean }) {
  return (
    <span
      className={classNames(
        "flex size-9 shrink-0 items-center justify-center rounded-control",
        "transition-colors duration-150 ease-standard",
        isSelected ? "bg-accent-fill text-on-accent" : "bg-fill text-label-secondary",
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
    </span>
  );
}

/** The round radio mark: a ring, filled with a dot once chosen. */
function RadioMark({ isSelected }: { isSelected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full",
        "transition-colors duration-150 ease-standard",
        isSelected ? "bg-accent-fill" : "border-[1.5px] border-label-tertiary",
      )}
    >
      {isSelected && <span className="size-[7px] rounded-full bg-on-accent" />}
    </span>
  );
}
