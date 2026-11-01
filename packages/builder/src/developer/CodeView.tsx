import { Check, Copy } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";

interface CodeViewProps {
  title: string;
  code: string;
  highlighted: ReactNode[];
}

/**
 * Read-only code, formatted and coloured. The block can be focused and scrolled with the
 * keyboard, is named for screen readers, and has a copy button that says when it worked.
 */
export function CodeView({ title, code, highlighted }: CodeViewProps) {
  const text = useBuilderText();
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h4
          id={titleId}
          className="text-caption font-semibold text-label-secondary uppercase tracking-wide"
        >
          {title}
        </h4>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(code).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex h-6 items-center gap-1 rounded px-1.5 text-caption text-accent hover:bg-fill focus-visible:focus-ring"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3" />
          ) : (
            <Copy aria-hidden="true" className="size-3" />
          )}
          <span aria-live="polite">
            {copied
              ? text("pageBuilder.code.copied")
              : text("pageBuilder.code.copy", { name: title })}
          </span>
        </button>
      </div>
      <pre
        tabIndex={0}
        aria-labelledby={titleId}
        className="max-h-80 overflow-auto rounded-control bg-fill p-3 font-mono text-[12px] leading-[18px] text-label focus-visible:focus-ring"
      >
        <code>{code === "" ? text("pageBuilder.code.empty") : highlighted}</code>
      </pre>
    </section>
  );
}
