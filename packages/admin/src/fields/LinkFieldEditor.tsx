import { useState } from "react";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { linkFromInputs, linkValue } from "./fieldValues.js";

/** A web address and the words to show for it, side by side. */
export function LinkFieldEditor({ value, onChange, controlId, hasError }: FieldEditorProps) {
  // Kept locally: link text typed before the address can't be stored yet, but mustn't vanish.
  const [inputs, setInputs] = useState(() => {
    const link = linkValue(value);
    return { url: link.url, label: link.label ?? "" };
  });

  function update(changes: Partial<typeof inputs>) {
    const next = { ...inputs, ...changes };
    setInputs(next);
    onChange(linkFromInputs(next.url, next.label));
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField
        id={controlId}
        label={t("fields.link.url")}
        type="url"
        inputMode="url"
        placeholder={t("fields.link.urlPlaceholder")}
        value={inputs.url}
        aria-invalid={hasError || undefined}
        onChange={(event) => update({ url: event.target.value })}
      />
      <TextField
        label={t("fields.link.label")}
        placeholder={t("fields.link.labelPlaceholder")}
        value={inputs.label}
        onChange={(event) => update({ label: event.target.value })}
      />
    </div>
  );
}
