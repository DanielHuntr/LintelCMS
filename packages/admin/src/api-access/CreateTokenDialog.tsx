import { TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { CopyButton } from "../design/CopyButton.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { CreatedApiToken, TokenAccess } from "./apiAccess.api.js";
import { useCreateApiToken } from "./apiAccess.queries.js";

interface CreateTokenDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Making a token takes two steps in one sheet: name it and choose what it may do, then copy
 * it. The token is shown only on the second step, because the API never shows it again.
 */
export function CreateTokenDialog({ open, onClose }: CreateTokenDialogProps) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState<TokenAccess>("read");
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const createToken = useCreateApiToken();

  function close() {
    setName("");
    setAccess("read");
    setCreated(null);
    createToken.reset();
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setCreated(await createToken.mutateAsync({ name, access }));
    } catch {
      // The error is shown under the name field.
    }
  }

  if (created) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t("apiAccess.createdTitle", { name: created.token.name })}
        description={t("apiAccess.createdDescription")}
        footer={
          <Button onClick={close} data-autofocus>
            {t("common.done")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-control bg-fill p-2 pl-3">
            <code
              aria-label={t("apiAccess.tokenLabel")}
              className="min-w-0 flex-1 font-mono text-footnote break-all text-label select-all"
            >
              {created.secret}
            </code>
            <CopyButton value={created.secret} label={t("apiAccess.copyToken")} />
          </div>
          <p className="flex items-start gap-2 text-footnote text-label-secondary">
            <TriangleAlert
              aria-hidden="true"
              strokeWidth={2}
              className="mt-0.5 size-4 shrink-0 text-warning"
            />
            {t("apiAccess.shownOnce")}
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("apiAccess.newTokenTitle")}
      description={t("apiAccess.newTokenDescription")}
      footer={
        <>
          <Button variant="plain" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="create-token-form" disabled={createToken.isPending}>
            {createToken.isPending ? t("apiAccess.creating") : t("apiAccess.create")}
          </Button>
        </>
      }
    >
      <form id="create-token-form" onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("apiAccess.tokenName")}
          hint={t("apiAccess.tokenNameHint")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={createToken.isError ? describeError(createToken.error) : undefined}
          maxLength={100}
          required
          data-autofocus
        />
        <div className="flex flex-col gap-1.5">
          {/* The radio group is named for screen readers; this is the same label for everyone else. */}
          <p aria-hidden="true" className="text-footnote font-medium text-label">
            {t("apiAccess.accessLabel")}
          </p>
          <SegmentedControl
            label={t("apiAccess.accessLabel")}
            options={[
              { value: "read", label: t("apiAccess.access.read") },
              { value: "readWrite", label: t("apiAccess.access.readWrite") },
            ]}
            value={access}
            onChange={setAccess}
          />
          <p className="text-footnote text-label-secondary">
            {access === "read"
              ? t("apiAccess.access.readHint")
              : t("apiAccess.access.readWriteHint")}
          </p>
        </div>
      </form>
    </Dialog>
  );
}
