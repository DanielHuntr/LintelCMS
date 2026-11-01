import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { radioGroupTargetIndex } from "../design/radioGroupKeys.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { selectedValues, toggleChoice } from "./fieldValues.js";

/**
 * Choices shown all at once: radio buttons (one), checkboxes (any number) and a button
 * group (one, as a row of buttons). Native inputs, so they work by keyboard and screen reader
 * without help; the shell wraps them in a fieldset named by the field's label.
 */

export function RadioFieldEditor({ field, value, onChange, controlId }: FieldEditorProps) {
  const [selected] = selectedValues(value);
  const choices = field.options.choices ?? [];
  return (
    <ChoiceList inline={field.options.inline === true}>
      {choices.map((choice, index) => (
        <label key={choice.value} className={choiceLabelClasses}>
          <input
            id={index === 0 ? controlId : undefined}
            type="radio"
            name={controlId}
            value={choice.value}
            checked={selected === choice.value}
            onChange={() => onChange(choice.value)}
            className="size-4 accent-accent-fill"
          />
          {choice.label}
        </label>
      ))}
    </ChoiceList>
  );
}

export function CheckboxesFieldEditor({ field, value, onChange, controlId }: FieldEditorProps) {
  const selected = selectedValues(value);
  const choices = field.options.choices ?? [];
  return (
    <ChoiceList inline={field.options.inline === true}>
      {choices.map((choice, index) => (
        <label key={choice.value} className={choiceLabelClasses}>
          <input
            id={index === 0 ? controlId : undefined}
            type="checkbox"
            checked={selected.includes(choice.value)}
            onChange={() => {
              const next = toggleChoice(choices, selected, choice.value);
              onChange(next.length === 0 ? null : next);
            }}
            className="size-4 rounded accent-accent-fill"
          />
          {choice.label}
        </label>
      ))}
    </ChoiceList>
  );
}

/** A row of buttons acting as one radio group: arrow keys move the choice, like a segmented control. */
export function ButtonGroupFieldEditor({ field, value, onChange, controlId }: FieldEditorProps) {
  const [selected] = selectedValues(value);
  const choices = field.options.choices ?? [];
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = choices.findIndex((choice) => choice.value === selected);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = radioGroupTargetIndex(event.key, index, choices.length);
    const choice = target === undefined ? undefined : choices[target];
    if (target === undefined || !choice) return;
    event.preventDefault();
    onChange(choice.value);
    buttons.current[target]?.focus();
  }

  return (
    <div
      role="radiogroup"
      className="inline-flex w-fit max-w-full flex-wrap rounded-control bg-fill p-0.5"
    >
      {choices.map((choice, index) => {
        const isSelected = choice.value === selected;
        const isTabStop = selectedIndex === -1 ? index === 0 : isSelected;
        return (
          <button
            key={choice.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            id={index === 0 ? controlId : undefined}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isTabStop ? 0 : -1}
            onClick={() => onChange(isSelected && !field.required ? null : choice.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={classNames(
              "h-8 rounded-[7px] px-3.5 text-footnote font-medium whitespace-nowrap",
              "transition duration-150 ease-standard focus-visible:focus-ring",
              isSelected
                ? "bg-surface text-label shadow-thumb"
                : "text-label-secondary hover:text-label",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

const choiceLabelClasses =
  "inline-flex min-h-8 cursor-pointer items-center gap-2 text-body text-label select-none";

function ChoiceList({ inline, children }: { inline: boolean; children: ReactNode }) {
  return (
    <div className={inline ? "flex flex-wrap gap-x-5 gap-y-1" : "flex flex-col gap-0.5"}>
      {children}
    </div>
  );
}
