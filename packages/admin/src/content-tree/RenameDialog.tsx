import { useId, useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { updateEntry } from "../content/content.api.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { TreeNode } from "./contentTree.types.js";
import { useRefreshContent } from "./contentTree.queries.js";
import type { TreeNotice } from "./TreeToast.js";

interface RenameDialogProps {
  node: TreeNode;
  onClose: () => void;
  onNotice: (notice: Omit<TreeNotice, "id">) => void;
}

/** "Rename…": changes the entry's title, as its editor would. Its address stays as it is. */
export function RenameDialog({ node, onClose, onNotice }: RenameDialogProps) {
  const refresh = useRefreshContent();
  const formId = useId();
  const [title, setTitle] = useState(node.title);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed === "") {
      setError(t("tree.rename.empty"));
      return;
    }
    if (trimmed === node.title) {
      onClose();
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      await updateEntry(node.id, { data: { title: trimmed } });
      await refresh([node.id]);
      onClose();
      onNotice({ tone: "neutral", message: t("tree.renamed", { title: trimmed }) });
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
      title={t("tree.rename.title", { title: node.title || t("tree.untitled") })}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={isWorking}>
            {t("tree.rename.confirm")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void handleSubmit(event)}>
        <TextField
          label={t("tree.rename.label")}
          hint={t("tree.rename.hint")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={error ?? undefined}
          data-autofocus=""
          autoComplete="off"
          maxLength={200}
        />
      </form>
    </Dialog>
  );
}
