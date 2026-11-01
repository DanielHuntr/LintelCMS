import { Plus, X } from "lucide-react";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { HttpHeader } from "./workflows.types.js";

/** Extra headers for an HTTP step, such as an Authorization your server expects. */
export function HeadersField({
  headers,
  onChange,
}: {
  headers: readonly HttpHeader[];
  onChange: (headers: HttpHeader[]) => void;
}) {
  function change(index: number, header: HttpHeader) {
    onChange(headers.map((existing, position) => (position === index ? header : existing)));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-footnote font-medium text-label">
        {t("stepEditor.headersLabel")}
      </legend>
      {headers.map((header, index) => (
        <div key={index} className="flex items-end gap-2">
          <TextField
            label={t("stepEditor.headerName")}
            value={header.name}
            placeholder="Authorization"
            onChange={(event) => change(index, { ...header, name: event.target.value })}
          />
          <TextField
            label={t("stepEditor.headerValue")}
            value={header.value}
            onChange={(event) => change(index, { ...header, value: event.target.value })}
          />
          <button
            type="button"
            aria-label={t("stepEditor.removeHeader", { name: header.name || String(index + 1) })}
            onClick={() => onChange(headers.filter((_header, position) => position !== index))}
            className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
      <div>
        <Button
          variant="tinted"
          size="small"
          icon={<Plus aria-hidden="true" />}
          onClick={() => onChange([...headers, { name: "", value: "" }])}
        >
          {t("stepEditor.addHeader")}
        </Button>
      </div>
    </fieldset>
  );
}
