import type { SectionTemplate } from "@lintel/builder-model";
import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { BlueprintSketch } from "../panels/BlueprintSketch.js";

interface EmptyPageStartProps {
  templates: readonly SectionTemplate[];
  onChooseTemplate: (templateId: string) => void;
  onStartBlank: () => void;
}

/**
 * What an empty page shows: a few ready-made sections to start from, so nobody faces a blank
 * canvas wondering what to do. Anything chosen can be changed afterwards.
 */
export function EmptyPageStart({ templates, onChooseTemplate, onStartBlank }: EmptyPageStartProps) {
  const text = useBuilderText();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="flex flex-1 justify-center overflow-auto bg-background p-8">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h2 ref={heading} tabIndex={-1} className="text-title text-label outline-none">
            {text("pageBuilder.start.title")}
          </h2>
          <p className="text-body text-label-secondary">{text("pageBuilder.start.description")}</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => onChooseTemplate(template.id)}
                className="flex h-full w-full flex-col gap-2 rounded-card bg-surface p-3 text-left shadow-float transition-transform duration-150 ease-standard hover:-translate-y-0.5 focus-visible:focus-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <BlueprintSketch blueprint={template.blueprint} />
                <span className="text-footnote font-semibold text-label">{template.label}</span>
                <span className="text-caption text-label-secondary">{template.description}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onStartBlank}
          className="flex h-9 items-center justify-center gap-1.5 self-center rounded-control px-4 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
        >
          <Plus aria-hidden="true" className="size-4" />
          {text("pageBuilder.start.blank")}
        </button>
        <p className="text-center text-caption text-label-tertiary">
          {text("pageBuilder.start.hint")}
        </p>
      </div>
    </div>
  );
}
