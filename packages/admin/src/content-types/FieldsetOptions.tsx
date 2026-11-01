import { Link } from "@tanstack/react-router";
import { SelectField } from "../design/SelectField.js";
import type { FieldOptions } from "../fields/field.types.js";
import { useFieldsets } from "../fieldsets/fieldsets.queries.js";
import { t } from "../i18n/strings.js";

/**
 * Which saved fieldset a Fieldset field uses. Its fields are edited on the fieldset's own
 * page, and every content type using it gets the changes.
 */
export function FieldsetOptions({
  options,
  onChange,
}: {
  options: FieldOptions;
  onChange: (changes: FieldOptions) => void;
}) {
  const fieldsets = useFieldsets();
  const list = fieldsets.data ?? [];
  const chosen = list.find((fieldset) => fieldset.handle === options.fieldset);

  if (fieldsets.isSuccess && list.length === 0) {
    return (
      <p className="text-body text-label-secondary">
        {t("fieldOptions.noFieldsets")}{" "}
        <Link to="/settings/fieldsets" className="text-accent hover:underline">
          {t("fieldOptions.makeFieldset")}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("fieldOptions.fieldset")}
        options={[
          { value: "", label: t("fieldOptions.chooseFieldset") },
          ...list.map((fieldset) => ({ value: fieldset.handle, label: fieldset.name })),
        ]}
        value={options.fieldset ?? ""}
        onValueChange={(fieldset) => onChange({ fieldset })}
        className="max-w-sm"
      />
      {chosen && (
        <p className="text-footnote text-label-secondary">
          {t("fieldOptions.fieldsetFields", {
            fields: chosen.fields.map((field) => field.label).join(", ") || "—",
          })}{" "}
          <Link
            to="/settings/fieldsets/$handle"
            params={{ handle: chosen.handle }}
            className="text-accent hover:underline"
          >
            {t("fieldOptions.editFieldset")}
          </Link>
        </p>
      )}
    </div>
  );
}
