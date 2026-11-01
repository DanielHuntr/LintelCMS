import { formatHtml, type PageDocument, type PageNode, rootNodeId } from "@lintel/builder-model";
import { FileCode2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { ComponentRegistry } from "../render/component-registry.js";
import { renderPage } from "../render/render-page.js";
import { inputClassName, PanelSection } from "../ui/controls.js";
import { CodeView } from "./CodeView.js";
import { highlightCss, highlightHtml } from "./highlight.js";

interface CodePanelProps {
  document: PageDocument;
  node: PageNode | null;
  registry: ComponentRegistry;
  isLocked: boolean;
  onApplyHtml: (nodeId: string, html: string) => void;
  onConvertToCode: (nodeId: string) => void;
  onChangeCode: (nodeId: string, code: { html: string; css: string; js: string }) => void;
  onPasteHtml: (html: string) => void;
}

/**
 * Developer mode's panel: the selected element's (or the page's) HTML and CSS, and three ways
 * to work in code: edit an element's HTML (read back into elements), convert it to a code
 * block, or edit a code block's HTML, CSS and JavaScript. Pasting HTML adds it to the page.
 */
export function CodePanel({
  document,
  node,
  registry,
  isLocked,
  onApplyHtml,
  onConvertToCode,
  onChangeCode,
  onPasteHtml,
}: CodePanelProps) {
  const text = useBuilderText();
  const target = node ?? document.root;
  const rendered = useMemo(
    () =>
      renderPage(document, registry, { nodeId: target.id === rootNodeId ? undefined : target.id }),
    [document, registry, target.id],
  );
  const html = useMemo(() => formatHtml(rendered.html), [rendered.html]);
  const name =
    node && node.id !== rootNodeId
      ? node.name || registry.find(node.type)?.definition.label || node.type
      : text("pageBuilder.code.thePage");
  const isElement = node !== null && node.id !== rootNodeId;

  return (
    <div className="flex flex-col">
      <PanelSection title={text("pageBuilder.code.viewTitle", { name })}>
        <CodeView
          title={text("pageBuilder.code.html")}
          code={html}
          highlighted={highlightHtml(html)}
        />
        <CodeView
          title={text("pageBuilder.code.css")}
          code={rendered.css.trim()}
          highlighted={highlightCss(rendered.css.trim())}
        />
      </PanelSection>
      {isElement && node.type === "codeBlock" && !isLocked && (
        <CodeBlockEditor key={node.id} node={node} onSave={(code) => onChangeCode(node.id, code)} />
      )}
      {isElement && node.type !== "codeBlock" && !isLocked && (
        <PanelSection title={text("pageBuilder.code.editTitle")}>
          <HtmlEditor
            key={`${node.id}:${html}`}
            initial={html}
            label={text("pageBuilder.code.editLabel", { name })}
            applyLabel={text("pageBuilder.code.apply")}
            onApply={(edited) => onApplyHtml(node.id, edited)}
          />
          <p className="text-caption text-label-secondary">{text("pageBuilder.code.editHint")}</p>
          <button
            type="button"
            onClick={() => onConvertToCode(node.id)}
            className="flex h-8 items-center justify-center gap-1.5 rounded-control bg-fill text-footnote font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
          >
            <FileCode2 aria-hidden="true" className="size-4" />
            {text("pageBuilder.code.convert")}
          </button>
          <p className="text-caption text-label-secondary">
            {text("pageBuilder.code.convertHint")}
          </p>
        </PanelSection>
      )}
      <PanelSection title={text("pageBuilder.code.pasteTitle")}>
        <HtmlEditor
          key="paste"
          initial=""
          label={text("pageBuilder.code.pasteLabel")}
          applyLabel={text("pageBuilder.code.pasteApply")}
          clearAfterApply
          onApply={onPasteHtml}
        />
        <p className="text-caption text-label-secondary">{text("pageBuilder.code.pasteHint")}</p>
      </PanelSection>
    </div>
  );
}

function HtmlEditor({
  initial,
  label,
  applyLabel,
  onApply,
  clearAfterApply,
}: {
  initial: string;
  label: string;
  applyLabel: string;
  onApply: (html: string) => void;
  clearAfterApply?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(initial);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-label-secondary">
        {label}
      </label>
      <textarea
        id={id}
        value={draft}
        spellCheck={false}
        rows={8}
        onChange={(event) => setDraft(event.target.value)}
        className={`${inputClassName} h-auto resize-y py-2 font-mono text-[12px] leading-[18px]`}
      />
      <button
        type="button"
        disabled={draft.trim() === "" || draft === initial}
        onClick={() => {
          onApply(draft);
          if (clearAfterApply) setDraft("");
        }}
        className="h-8 self-start rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring disabled:opacity-40"
      >
        {applyLabel}
      </button>
    </div>
  );
}

function CodeBlockEditor({
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
