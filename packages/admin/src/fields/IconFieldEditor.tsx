import { X } from "lucide-react";
import { useState } from "react";
import { classNames } from "../design/classNames.js";
import { SearchField } from "../design/SearchField.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { fieldIcons, iconWords } from "./fieldIcons.js";
import { textValue } from "./fieldValues.js";

/** An icon picked from a grid, with a search box to narrow it down. */
export function IconFieldEditor({ field, value, onChange }: FieldEditorProps) {
  const [query, setQuery] = useState("");
  const chosen = textValue(value);
  const ChosenIcon = fieldIcons[chosen];
  const names = Object.keys(fieldIcons).filter((name) =>
    iconWords(name).includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-fill text-label">
          {ChosenIcon ? (
            <ChosenIcon aria-hidden="true" strokeWidth={1.75} className="size-5" />
          ) : (
            <span className="text-caption text-label-tertiary">{t("fields.icon.none")}</span>
          )}
        </span>
        <SearchField
          label={t("fields.icon.search", { label: field.label })}
          value={query}
          onValueChange={setQuery}
          className="min-w-0 flex-1"
        />
        {chosen !== "" && !field.required && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("fields.icon.clear", { label: field.label })}
            className="flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
          >
            <X aria-hidden="true" strokeWidth={2} className="size-4" />
          </button>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label={field.label}
        className="grid max-h-44 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1 overflow-y-auto rounded-control bg-fill/50 p-1.5"
      >
        {names.map((name) => {
          const Icon = fieldIcons[name];
          if (!Icon) return null;
          const isChosen = name === chosen;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={isChosen}
              aria-label={iconWords(name)}
              title={iconWords(name)}
              onClick={() => onChange(name)}
              className={classNames(
                "flex aspect-square items-center justify-center rounded-control transition-colors duration-150 ease-standard focus-visible:focus-ring",
                isChosen
                  ? "bg-accent text-on-accent"
                  : "text-label-secondary hover:bg-surface hover:text-label",
              )}
            >
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
