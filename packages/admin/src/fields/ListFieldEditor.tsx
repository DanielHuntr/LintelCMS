import { Plus, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { stringListFromItems, stringListValue } from "./fieldValues.js";

/**
 * A list of short items, one box each. Enter adds an item below; Backspace in an empty box
 * removes it, the way lists work in Notes.
 */
export function ListFieldEditor({ field, value, onChange, controlId, hasError }: FieldEditorProps) {
  // Kept locally so a new, still-empty row stays on screen; only filled rows are saved.
  const [items, setItems] = useState(() => {
    const saved = stringListValue(value);
    return saved.length > 0 ? saved : [""];
  });
  const list = useRef<HTMLUListElement>(null);
  const { maxItems } = field.options;
  const isFull = maxItems !== undefined && items.length >= maxItems;

  function update(next: string[]) {
    setItems(next);
    onChange(stringListFromItems(next.map((item) => item.trim()).filter((item) => item !== "")));
  }

  function focusItem(index: number) {
    requestAnimationFrame(() =>
      list.current?.querySelectorAll<HTMLInputElement>("input")[index]?.focus(),
    );
  }

  function addAfter(index: number) {
    if (isFull) return;
    update([...items.slice(0, index + 1), "", ...items.slice(index + 1)]);
    focusItem(index + 1);
  }

  function remove(index: number) {
    const next = items.filter((_, position) => position !== index);
    update(next.length > 0 ? next : [""]);
    focusItem(Math.max(0, index - 1));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      addAfter(index);
    } else if (event.key === "Backspace" && items[index] === "" && items.length > 1) {
      event.preventDefault();
      remove(index);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ul ref={list} className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              id={index === 0 ? controlId : undefined}
              aria-label={t("fields.list.item", { label: field.label, number: index + 1 })}
              value={item}
              onChange={(event) =>
                update(
                  items.map((existing, position) =>
                    position === index ? event.target.value : existing,
                  ),
                )
              }
              onKeyDown={(event) => handleKeyDown(event, index)}
              aria-invalid={hasError || undefined}
              className={classNames("h-9", controlClasses({ hasError }))}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={t("fields.list.remove", { number: index + 1 })}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-danger focus-visible:focus-ring"
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
        onClick={() => addAfter(items.length - 1)}
        disabled={isFull}
        className="self-start"
      >
        {t("fields.list.add")}
      </Button>
      {isFull && (
        <p className="text-footnote text-label-secondary">
          {t("fields.list.full", { count: maxItems })}
        </p>
      )}
    </div>
  );
}
