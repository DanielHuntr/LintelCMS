import { Check, FileStack, List, Newspaper, type LucideIcon } from "lucide-react";
import { useId } from "react";
import type { CollectionStructure } from "../content/content.types.js";
import { classNames } from "../design/classNames.js";
import { t, type StringKey } from "../i18n/strings.js";

const structures: Array<{
  value: CollectionStructure;
  icon: LucideIcon;
  title: StringKey;
  description: StringKey;
}> = [
  {
    value: "tree",
    icon: FileStack,
    title: "structure.tree",
    description: "structure.treeDescription",
  },
  {
    value: "dated",
    icon: Newspaper,
    title: "structure.dated",
    description: "structure.datedDescription",
  },
  { value: "flat", icon: List, title: "structure.flat", description: "structure.flatDescription" },
];

interface StructureChoiceProps {
  value: CollectionStructure;
  onChange: (structure: CollectionStructure) => void;
}

/**
 * How entries are organised, asked in plain words rather than "tree", "dated" and "flat".
 * Real radio buttons underneath, so arrow keys and screen readers work as people expect.
 */
export function StructureChoice({ value, onChange }: StructureChoiceProps) {
  const name = useId();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-footnote font-medium text-label">
        {t("structure.question")}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {structures.map((structure) => {
          const isSelected = structure.value === value;
          return (
            <label
              key={structure.value}
              className={classNames(
                "relative flex cursor-pointer flex-col gap-3 rounded-card p-4 transition duration-150 ease-standard",
                "has-[:focus-visible]:focus-ring",
                isSelected ? "bg-accent/10 ring-2 ring-accent" : "bg-fill/60 hover:bg-fill",
              )}
            >
              <input
                type="radio"
                name={name}
                value={structure.value}
                checked={isSelected}
                onChange={() => onChange(structure.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between">
                <span
                  className={classNames(
                    "flex size-9 items-center justify-center rounded-[9px]",
                    isSelected
                      ? "bg-accent-fill text-on-accent"
                      : "bg-surface text-label-secondary",
                  )}
                >
                  <structure.icon aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
                </span>
                {isSelected && (
                  <Check aria-hidden="true" strokeWidth={2.5} className="size-4 text-accent" />
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-medium text-label">{t(structure.title)}</span>
                <span className="text-footnote text-label-secondary">
                  {t(structure.description)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
