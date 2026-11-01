import { Check, Download, Link2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { DeleteAssetDialog } from "./DeleteAssetDialog.js";
import type { Asset } from "./media.api.js";

const COPIED_FEEDBACK_MILLISECONDS = 2000;

interface AssetActionsProps {
  asset: Asset;
  canDelete: boolean;
  onDeleted: () => void;
}

/** Copy the public address, download the original, or delete (after asking). */
export function AssetActions({ asset, canDelete, onDeleted }: AssetActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MILLISECONDS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyUrl() {
    await navigator.clipboard.writeText(asset.url);
    setCopied(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="tinted"
        size="small"
        icon={copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        onClick={copyUrl}
      >
        <span aria-live="polite">
          {copied ? t("media.detail.copied") : t("media.detail.copyUrl")}
        </span>
      </Button>
      <a
        href={asset.url}
        download={asset.filename}
        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent/12 px-3 text-footnote font-medium text-accent transition duration-150 ease-standard hover:bg-accent/18 focus-visible:focus-ring"
      >
        <Download aria-hidden="true" className="size-[1.1em]" />
        {t("media.detail.download")}
      </a>
      {canDelete && (
        <Button
          variant="plain"
          size="small"
          className="ms-auto text-danger! hover:bg-danger/10"
          icon={<Trash2 aria-hidden="true" />}
          onClick={() => setIsConfirmingDelete(true)}
        >
          {t("media.delete.button")}
        </Button>
      )}
      {isConfirmingDelete && (
        <DeleteAssetDialog
          asset={asset}
          onCancel={() => setIsConfirmingDelete(false)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
