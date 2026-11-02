import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";

interface PublishWithParentDialogProps {
  open: boolean;
  /** The page being published. */
  title: string;
  /** The pages above it that aren't published, from the top down. */
  ancestors: ReadonlyArray<{ id: string; title: string }>;
  isWorking: boolean;
  error: string | null;
  onPublishWithParent: () => void;
  onPublishAlone: () => void;
  onCancel: () => void;
}

/**
 * Asked before publishing a page whose parent (or a page further up) isn't published:
 * on its own it would go live under a page visitors can't open. Publishing it alone stays
 * possible; publishing them together is the main answer.
 */
export function PublishWithParentDialog({
  open,
  title,
  ancestors,
  isWorking,
  error,
  onPublishWithParent,
  onPublishAlone,
  onCancel,
}: PublishWithParentDialogProps) {
  const count = ancestors.length;
  const parent = ancestors[0]?.title || t("editor.untitled");
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="alert"
      title={t("workspace.parentUnpublished.title", { count })}
      description={t("workspace.parentUnpublished.message", { count, title, parent })}
      footer={
        // Three answers don't fit side by side in an alert, so they stack, the main one first.
        <div className="flex flex-col gap-2">
          <Button onClick={onPublishWithParent} disabled={isWorking} data-autofocus>
            {t("workspace.parentUnpublished.withParent", { count })}
          </Button>
          <Button variant="tinted" onClick={onPublishAlone} disabled={isWorking}>
            {t("workspace.parentUnpublished.alone")}
          </Button>
          <Button variant="plain" onClick={onCancel} disabled={isWorking}>
            {t("common.cancel")}
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="text-footnote text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
