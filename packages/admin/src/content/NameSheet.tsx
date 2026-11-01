import { useState, type FormEvent, type ReactNode } from "react";
import { describeError } from "../api/describeError.js";
import { handleFromLabel } from "../content-types/handle.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";

interface NameSheetProps {
  open: boolean;
  title: string;
  description?: string;
  nameLabel: string;
  submitLabel: string;
  /** For renaming. A new thing starts with an empty name. */
  initialName?: string;
  /** Show the handle the name makes, for things code and websites refer to by handle. */
  showsHandle?: boolean;
  /** Extra settings under the name, such as a menu's number of levels. */
  children?: ReactNode;
  onSubmit: (name: string, handle: string) => Promise<void>;
  onClose: () => void;
}

/**
 * "Name it" in a sheet: the one question needed to make (or rename) a taxonomy, a global
 * set or a menu. The handle is made from the name, the same way as a field's.
 */
export function NameSheet({
  open,
  title,
  description,
  nameLabel,
  submitLabel,
  initialName = "",
  showsHandle = false,
  children,
  onSubmit,
  onClose,
}: NameSheetProps) {
  const [name, setName] = useState(initialName);
  const [problem, setProblem] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const handle = handleFromLabel(name, "item");

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim() === "" || handle === "") {
      setProblem(t("builder.problem.name"));
      return;
    }
    setIsWorking(true);
    setProblem(undefined);
    try {
      await onSubmit(name.trim(), handle);
      setName(initialName);
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={isWorking}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5 pt-2 pb-1">
        <TextField
          label={nameLabel}
          value={name}
          error={problem}
          hint={showsHandle && handle ? t("contentModel.handlePreview", { handle }) : undefined}
          data-autofocus
          onChange={(event) => setName(event.target.value)}
        />
        {children}
      </form>
    </Dialog>
  );
}
