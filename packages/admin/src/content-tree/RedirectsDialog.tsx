import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import { addRedirectsForMove } from "./contentTree.api.js";
import type { AddressChange } from "./contentTree.types.js";
import type { TreeNotice } from "./TreeToast.js";

interface RedirectsDialogProps {
  changes: readonly AddressChange[];
  onClose: () => void;
  onNotice: (notice: Omit<TreeNotice, "id">) => void;
}

/**
 * After a move changed live pages' addresses: the old and new address of each, and a button
 * that adds a redirect from every old one (through the SEO tools' redirects).
 */
export function RedirectsDialog({ changes, onClose, onNotice }: RedirectsDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function addRedirects() {
    setIsWorking(true);
    setError(null);
    try {
      const { added, kept } = await addRedirectsForMove(changes);
      onNotice({ tone: "neutral", message: describeResult(added, kept) });
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("tree.redirects.title")}
      description={t("tree.redirects.description")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("tree.redirects.notNow")}
          </Button>
          <Button onClick={() => void addRedirects()} disabled={isWorking} data-autofocus="">
            {t("tree.redirects.confirm")}
          </Button>
        </>
      }
    >
      <ul className="flex max-h-72 flex-col overflow-y-auto">
        {changes.map((change) => (
          <li
            key={change.entryId}
            className="flex flex-col gap-0.5 py-2 hairline-top first:border-t-0"
          >
            <span className="text-footnote font-medium text-label">
              {change.title || t("tree.untitled")}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-footnote text-label-secondary">
              <span className="sr-only">{t("tree.redirects.from")}</span>
              <code className="font-mono">{change.from}</code>
              <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
              <span className="sr-only">{t("tree.redirects.to")}</span>
              <code className="font-mono text-label">{change.to}</code>
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-footnote text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function describeResult(added: number, kept: number): string {
  if (kept > 0) return t("tree.redirects.kept", { added, kept });
  return added === 1 ? t("tree.redirects.addedOne") : t("tree.redirects.added", { count: added });
}
