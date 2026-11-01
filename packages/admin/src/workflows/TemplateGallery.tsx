import { t } from "../i18n/strings.js";
import { type WorkflowTemplate, workflowTemplates } from "./workflowTemplates.js";

interface TemplateGalleryProps {
  person: { email: string };
  onUse: (template: WorkflowTemplate) => void;
}

/** Ready-made automations as tiles; choosing one opens it in the builder to adjust. */
export function TemplateGallery({ onUse }: TemplateGalleryProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
      {workflowTemplates.map((template) => {
        const Icon = template.icon;
        return (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onUse(template)}
              className="flex h-full w-full items-start gap-3 rounded-card bg-surface p-4 text-start transition-colors duration-150 ease-standard hover:bg-surface-raised focus-visible:focus-ring motion-safe:active:scale-[0.99]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent/12 text-accent">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-body font-semibold text-label">{t(template.name)}</span>
                <span className="text-footnote text-label-secondary">
                  {t(template.description)}
                </span>
                <span className="mt-1 text-footnote font-medium text-accent">
                  {t("templates.use")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
