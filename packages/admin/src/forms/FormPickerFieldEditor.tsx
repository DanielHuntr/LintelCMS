import { ChevronsUpDown } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import type { FieldEditorProps } from "../fields/fieldEditorProps.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { useForms } from "./forms.queries.js";

/**
 * The editor for a `form` field, such as the Form section on pages: a list of the site's
 * forms. It stores the form's handle, which is what the website asks the API for.
 */
export function FormPickerFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const session = useSession();
  const canSeeForms = useCan("forms:read") && session.enabledPlugins.includes("forms");
  const forms = useForms(canSeeForms);
  const selected = typeof value === "string" ? value : "";
  const known = forms.data?.some((form) => form.handle === selected) ?? true;

  if (!canSeeForms) {
    return <p className="text-footnote text-label-secondary">{t("forms.picker.unavailable")}</p>;
  }

  return (
    <div className="flex max-w-sm flex-col gap-1.5">
      <div className="relative">
        <select
          id={controlId}
          value={selected}
          disabled={forms.isPending}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
          aria-required={field.required || undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={classNames("h-10 appearance-none pe-9", controlClasses({ hasError }))}
        >
          <option value="">
            {forms.isPending ? t("forms.picker.loading") : t("forms.picker.choose")}
          </option>
          {!known && (
            <option value={selected}>{t("forms.picker.missing", { handle: selected })}</option>
          )}
          {forms.data?.map((form) => (
            <option key={form.id} value={form.handle}>
              {form.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          aria-hidden="true"
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
        />
      </div>
      {forms.data?.length === 0 && (
        <p className="text-footnote text-label-secondary">{t("forms.picker.none")}</p>
      )}
    </div>
  );
}
