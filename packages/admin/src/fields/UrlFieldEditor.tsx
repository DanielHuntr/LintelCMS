import { ExternalLink } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

/** A web address, with a way to open it and check it's the right page. */
export function UrlFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const address = textValue(value).trim();
  const canOpen = /^https?:\/\/\S+$/i.test(address);

  return (
    <div className="flex items-center gap-2">
      <input
        id={controlId}
        type="url"
        inputMode="url"
        spellCheck={false}
        placeholder={t("fields.url.placeholder")}
        value={textValue(value)}
        onChange={(event) => onChange(event.target.value)}
        aria-required={field.required || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={classNames("h-10", controlClasses({ hasError }))}
      />
      {canOpen && (
        <a
          href={address}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t("fields.url.open", { label: field.label })}
          title={t("fields.url.open", { label: field.label })}
          className="flex size-10 shrink-0 items-center justify-center rounded-control text-accent hover:bg-fill focus-visible:focus-ring"
        >
          <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </a>
      )}
    </div>
  );
}
