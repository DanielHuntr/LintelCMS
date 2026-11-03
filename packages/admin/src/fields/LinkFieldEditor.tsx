import { pageLinkHref, readPageLinkId } from "@lintel/builder-model";
import { useState } from "react";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { ChoosePageButton } from "../page-links/ChoosePageButton.js";
import { LinkedPageField } from "../page-links/LinkedPageField.js";
import { TypeAddressButton } from "../page-links/TypeAddressButton.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { linkFromInputs, linkValue } from "./fieldValues.js";

/**
 * A web address and the words to show for it, side by side. "Choose a page…" links to a page
 * of the site by the page itself, so the link follows it if its address changes; the page's
 * title shows where the address would be, and its title fills in the words when there are none.
 */
export function LinkFieldEditor({ value, onChange, controlId, hasError }: FieldEditorProps) {
  // Kept locally: link text typed before the address can't be stored yet, but mustn't vanish.
  const [inputs, setInputs] = useState(() => {
    const link = linkValue(value);
    return { url: link.url, label: link.label ?? "" };
  });
  const linkedPageId = readPageLinkId(inputs.url);

  function update(changes: Partial<typeof inputs>) {
    const next = { ...inputs, ...changes };
    setInputs(next);
    onChange(linkFromInputs(next.url, next.label));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {linkedPageId ? (
          <LinkedPageField id={controlId} entryId={linkedPageId} />
        ) : (
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
        )}
        <TextField
          label={t("fields.link.label")}
          placeholder={t("fields.link.labelPlaceholder")}
          value={inputs.label}
          onChange={(event) => update({ label: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <ChoosePageButton
          onChoose={(page) =>
            update({ url: pageLinkHref(page.id), label: inputs.label || page.title })
          }
        />
        {linkedPageId && (
          <TypeAddressButton
            onClick={() => {
              update({ url: "" });
              // The address box takes the page's place; put the cursor in it.
              requestAnimationFrame(() => document.getElementById(controlId)?.focus());
            }}
          />
        )}
      </div>
    </div>
  );
}
