import { ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames } from "../ui/controls.js";
import { type SkillLevel, skillLevels } from "./skill-levels.js";

interface SkillLevelMenuProps {
  level: SkillLevel;
  canEditCode: boolean;
  onChange: (level: SkillLevel) => void;
}

const names: Record<SkillLevel, BuilderStringKey> = {
  beginner: "pageBuilder.skill.beginner",
  designer: "pageBuilder.skill.designer",
  developer: "pageBuilder.skill.developer",
};

const descriptions: Record<SkillLevel, BuilderStringKey> = {
  beginner: "pageBuilder.skill.beginnerDescription",
  designer: "pageBuilder.skill.designerDescription",
  developer: "pageBuilder.skill.developerDescription",
};

/** "Tools: Beginner": a small popover to choose how much of the builder to show. */
export function SkillLevelMenu({ level, canEditCode, onChange }: SkillLevelMenuProps) {
  const text = useBuilderText();
  const [isOpen, setIsOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const groupName = useId();
  const close = () => {
    setIsOpen(false);
    button.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        data-tour="skill-level"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 items-center gap-1 rounded-control px-2 text-footnote font-medium text-label hover:bg-fill focus-visible:focus-ring"
      >
        {text("pageBuilder.skill.button", { level: text(names[level]) })}
        <ChevronDown aria-hidden="true" className="size-4 text-label-secondary" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label={text("pageBuilder.skill.label")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
          className="absolute top-10 inset-e-0 z-30 w-80 rounded-panel bg-surface-raised p-3 shadow-float hairline-ring"
        >
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-2 px-1 text-footnote font-semibold text-label">
              {text("pageBuilder.skill.label")}
            </legend>
            {skillLevels.map((option) => {
              const disabled = option === "developer" && !canEditCode;
              const descriptionId = `${groupName}-${option}`;
              return (
                <label
                  key={option}
                  className={classNames(
                    "flex cursor-pointer items-start gap-3 rounded-control p-2 hover:bg-fill",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={option}
                    checked={level === option}
                    disabled={disabled}
                    aria-describedby={descriptionId}
                    onChange={() => {
                      onChange(option);
                      close();
                    }}
                    className="mt-1 accent-[var(--color-accent)] focus-visible:focus-ring"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-footnote font-medium text-label">
                      {text(names[option])}
                    </span>
                    <span id={descriptionId} className="text-caption text-label-secondary">
                      {disabled
                        ? text("pageBuilder.skill.developerNeedsPermission")
                        : text(descriptions[option])}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </div>
      )}
    </div>
  );
}
