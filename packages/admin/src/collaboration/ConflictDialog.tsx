import { useState } from "react";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";

/** One thing both people changed: its name, and each person's value when it can be shown. */
export interface ClashItem {
  label: string;
  mine?: string;
  theirs?: string;
}

interface ConflictDialogProps {
  /** Who saved the other changes, when known. */
  personName: string | null;
  items: readonly ClashItem[];
  onKeepMine: () => void | Promise<void>;
  onUseTheirs: () => void | Promise<void>;
  /** Closing it decides nothing: the question comes back with the next save. */
  onClose: () => void;
}

/**
 * Two people changed the same thing, so one of them has to choose. It says who and what in
 * plain words, and both answers are safe: what isn't chosen stays in History, and everything
 * they didn't both change is kept either way.
 */
export function ConflictDialog({
  personName,
  items,
  onKeepMine,
  onUseTheirs,
  onClose,
}: ConflictDialogProps) {
  const [isWorking, setIsWorking] = useState(false);
  const answer = (choose: () => void | Promise<void>) => async () => {
    setIsWorking(true);
    try {
      await choose();
    } finally {
      setIsWorking(false);
    }
  };
  const theirsLabel = personName
    ? t("collab.conflict.theirs", { name: personName })
    : t("collab.conflict.theirsSomeone");

  return (
    <Dialog
      open
      onClose={onClose}
      size="alert"
      title={
        personName
          ? t("collab.conflict.title", { name: personName })
          : t("collab.conflict.titleSomeone")
      }
      footer={
        <>
          <Button variant="tinted" disabled={isWorking} onClick={() => void answer(onUseTheirs)()}>
            {personName
              ? t("collab.conflict.useTheirs", { name: personName })
              : t("collab.conflict.useTheirsSomeone")}
          </Button>
          <Button
            variant="filled"
            data-autofocus
            disabled={isWorking}
            onClick={() => void answer(onKeepMine)()}
          >
            {t("collab.conflict.keepMine")}
          </Button>
        </>
      }
    >
      <p className="text-footnote text-label-secondary">{t("collab.conflict.both")}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.label} className="text-body text-label">
            <span className="font-medium">{item.label}</span>
            {item.mine !== undefined && item.theirs !== undefined && (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-footnote">
                <dt className="text-label-secondary">{t("collab.conflict.yours")}</dt>
                <dd className="min-w-0 truncate">{item.mine}</dd>
                <dt className="text-label-secondary">{theirsLabel}</dt>
                <dd className="min-w-0 truncate">{item.theirs}</dd>
              </dl>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-footnote text-label-secondary">{t("collab.conflict.nothingLost")}</p>
    </Dialog>
  );
}
