import { Plus, X } from "lucide-react";
import { useId, useRef } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import type { SelectChoice } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { renameChoice } from "./blueprintDraft.js";

interface ChoicesEditorProps {
  choices: readonly SelectChoice[];
  onChange: (choices: SelectChoice[]) => void;
}

/**
 * The choices of a select field. Each has the label editors see and the value that's stored,
 * which is made from the label until it's changed by hand (like a field's handle).
 */
export function ChoicesEditor({ choices, onChange }: ChoicesEditorProps) {
  const labelHeaderId = useId();
  const valueHeaderId = useId();
  const list = useRef<HTMLUListElement>(null);

  function update(index: number, choice: SelectChoice) {
    onChange(choices.map((existing, position) => (position === index ? choice : existing)));
  }

  function addChoice() {
    onChange([...choices, { label: "", value: "" }]);
    // Put the cursor in the new row's label, ready to type.
    requestAnimationFrame(() =>
      list.current?.querySelector<HTMLInputElement>("li:last-child input")?.focus(),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-footnote font-medium text-label">{t("builder.choices")}</p>
      {choices.length > 0 && (
        <div
          aria-hidden="true"
          className="grid grid-cols-[1fr_1fr_2rem] gap-2 px-1 text-caption text-label-secondary"
        >
          <span id={labelHeaderId}>{t("builder.choiceLabel")}</span>
          <span id={valueHeaderId}>{t("builder.choiceValue")}</span>
        </div>
      )}
      <ul ref={list} className="flex flex-col gap-2">
        {choices.map((choice, index) => (
          <li key={index} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2">
            <input
              aria-label={t("builder.choiceLabelNumbered", { number: index + 1 })}
              value={choice.label}
              onChange={(event) => update(index, renameChoice(choice, event.target.value))}
              className={classNames("h-9", controlClasses())}
            />
            <input
              aria-label={t("builder.choiceValueNumbered", { number: index + 1 })}
              value={choice.value}
              spellCheck={false}
              onChange={(event) => update(index, { ...choice, value: event.target.value })}
              className={classNames("h-9 font-mono text-footnote", controlClasses())}
            />
            <button
              type="button"
              onClick={() => onChange(choices.filter((_, position) => position !== index))}
              aria-label={t("builder.removeChoice", { label: choice.label || String(index + 1) })}
              className="flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-danger focus-visible:focus-ring"
            >
              <X aria-hidden="true" strokeWidth={2} className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="plain"
        size="small"
        icon={<Plus aria-hidden="true" />}
        onClick={addChoice}
        className="self-start"
      >
        {t("builder.addChoice")}
      </Button>
    </div>
  );
}
