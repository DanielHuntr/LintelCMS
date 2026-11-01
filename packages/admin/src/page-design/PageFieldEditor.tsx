import { Link, useParams } from "@tanstack/react-router";
import { PanelsTopLeft } from "lucide-react";
import type { FieldEditorProps } from "../fields/fieldEditorProps.js";
import { newEntryId } from "../content/newEntryId.js";
import { t } from "../i18n/strings.js";

/**
 * A page design field in the entry editor: how much the page has, and the way into the
 * builder. The design itself is edited full screen (PageDesignPage), not in the form.
 */
export function PageFieldEditor({ field, value, controlId, describedBy }: FieldEditorProps) {
  const params = useParams({ strict: false });
  const collection = params.collection ?? "";
  const entryId = params.entryId ?? newEntryId;
  const sections = countSections(value);

  return (
    <div className="flex items-center gap-4 rounded-card bg-surface p-4 hairline-ring">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-fill text-accent">
        <PanelsTopLeft aria-hidden="true" className="size-5" />
      </span>
      <p id={`${controlId}-summary`} className="min-w-0 flex-1 text-footnote text-label-secondary">
        {entryId === newEntryId
          ? t("pageDesign.field.saveFirst")
          : sections === 0
            ? t("pageDesign.field.empty")
            : t("pageDesign.field.summary", { count: sections })}
      </p>
      {entryId !== newEntryId && (
        <Link
          id={controlId}
          to="/content/$collection/$entryId/design/$field"
          params={{ collection, entryId, field: field.handle }}
          aria-describedby={[`${controlId}-summary`, describedBy].filter(Boolean).join(" ")}
          className="flex h-9 shrink-0 items-center rounded-control bg-accent-fill px-4 text-body font-semibold text-on-accent transition-transform duration-150 ease-standard focus-visible:focus-ring motion-safe:active:scale-[0.98]"
        >
          {t("pageDesign.field.edit")}
        </Link>
      )}
    </div>
  );
}

function countSections(value: unknown): number {
  if (typeof value !== "object" || value === null || !("root" in value)) return 0;
  const root = (value as { root: { children?: unknown } }).root;
  return Array.isArray(root?.children) ? root.children.length : 0;
}
