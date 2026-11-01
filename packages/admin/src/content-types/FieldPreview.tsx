import { useState } from "react";
import { FieldEditor } from "../fields/FieldEditor.js";
import { FieldGrid } from "../fields/FieldGrid.js";
import type { Field, FieldValue } from "../fields/field.types.js";
import { columnsForWidth } from "../fields/fieldLayout.js";
import type { InnerFieldProps } from "../fields/fieldEditorProps.js";
import { t } from "../i18n/strings.js";

/**
 * The field as editors will see it, to try out while setting it up: its share of a row on
 * the editor's grid, then the field itself, which can be typed in (nothing is saved).
 */
export function FieldPreview({ field, siblings }: { field: Field; siblings: readonly Field[] }) {
  const [value, setValue] = useState<unknown>(field.default);
  const span = columnsForWidth[field.width ?? 100];
  const shown: Field = { ...field, conditions: undefined, hidden: false };
  const siblingValues = Object.fromEntries(
    siblings.map((sibling) => [sibling.handle, sibling.default]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className="grid grid-cols-12 gap-1"
        role="img"
        aria-label={t("fieldSettings.previewWidth", { width: field.width ?? 100 })}
      >
        <span className="h-2 rounded-full bg-accent" style={{ gridColumn: `span ${span}` }} />
        {span < 12 && (
          <span
            className="h-2 rounded-full border border-dashed border-label-tertiary/60"
            style={{ gridColumn: `span ${12 - span}` }}
          />
        )}
      </div>
      {field.type === "hidden" ? (
        <p className="text-footnote text-label-secondary">{t("fieldSettings.previewHidden")}</p>
      ) : field.type === "tab" ? (
        <p className="text-footnote text-label-secondary">
          {t("fieldSettings.previewTab", { label: field.label })}
        </p>
      ) : (
        <div className="rounded-card bg-surface p-4 hairline-ring">
          <FieldGrid
            fields={[{ ...shown, width: 100 }]}
            data={{ ...siblingValues, [field.handle]: value }}
            errors={{}}
            onChange={(_handle, next: FieldValue) => setValue(next)}
            renderField={(props: InnerFieldProps) => <FieldEditor {...props} />}
          />
        </div>
      )}
    </div>
  );
}
