import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../i18n/strings.js";
import { Button } from "./Button.js";

interface CopyButtonProps {
  /** What goes on the clipboard. */
  value: string;
  /** Names what is copied for screen readers, e.g. "Copy the token". */
  label: string;
  variant?: "tinted" | "plain";
}

/**
 * Copies text to the clipboard and says so for two seconds. The confirmation is announced
 * too, so people who can't see the button change still know it worked.
 */
export function CopyButton({ value, label, variant = "tinted" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <>
      <Button
        variant={variant}
        size="small"
        aria-label={label}
        icon={
          copied ? (
            <Check aria-hidden="true" strokeWidth={2.25} className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" strokeWidth={2} className="size-3.5" />
          )
        }
        onClick={() => void copy()}
      >
        {copied ? t("copy.copied") : t("copy.copy")}
      </Button>
      <span role="status" className="sr-only">
        {copied ? t("copy.copied") : ""}
      </span>
    </>
  );
}
