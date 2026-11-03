import type { PageNode } from "@lintel/builder-model";
import { useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName, PanelSection } from "../ui/controls.js";

/**
 * A Code element's HTML, CSS and JavaScript, for people allowed to write code. Shown in the
 * Content panel under the fields its markers make; changes are kept until Save code, so a
 * half-typed tag never reaches the page.
 */
export function CodeBlockEditor({
  node,
  onSave,
}: {
  node: PageNode;
  onSave: (code: { html: string; css: string; js: string }) => void;
}) {
  const text = useBuilderText();
  const read = (prop: string) =>
    typeof node.props[prop] === "string" ? (node.props[prop] as string) : "";
  const [code, setCode] = useState({ html: read("html"), css: read("css"), js: read("js") });
  const changed = code.html !== read("html") || code.css !== read("css") || code.js !== read("js");
  const fields = [
    { key: "html", label: text("pageBuilder.code.html") },
    { key: "css", label: text("pageBuilder.code.css") },
    { key: "js", label: text("pageBuilder.code.js") },
  ] as const;
  return (
    <PanelSection title={text("pageBuilder.code.blockTitle")}>
      <p className="text-caption text-label-secondary">{text("pageBuilder.code.markersHint")}</p>
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1 text-caption text-label-secondary">
          {field.label}
          <textarea
            value={code[field.key]}
            spellCheck={false}
            rows={field.key === "js" ? 4 : 7}
            onChange={(event) => setCode({ ...code, [field.key]: event.target.value })}
            className={`${inputClassName} h-auto resize-y py-2 font-mono text-[12px] leading-[18px]`}
          />
        </label>
      ))}
      <p className="text-caption text-label-tertiary">{text("pageBuilder.code.scriptsHint")}</p>
      <button
        type="button"
        disabled={!changed}
        onClick={() => onSave(code)}
        className="h-8 self-start rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring disabled:opacity-40"
      >
        {text("pageBuilder.code.saveCode")}
      </button>
    </PanelSection>
  );
}
