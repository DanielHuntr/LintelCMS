import { useState, type FormEvent } from "react";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { EmailField } from "../design/EmailField.js";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import type { Account } from "./account.api.js";
import { useRequestEmailChange } from "./account.queries.js";
import { AccountSection } from "./AccountSection.js";

/**
 * Your email. Changing it sends a link to the new address; nothing changes until it is
 * opened, so a typo can't lock you out.
 */
export function EmailSection({ account }: { account: Account }) {
  const [isChanging, setIsChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const request = useRequestEmailChange();

  function close() {
    setIsChanging(false);
    setNewEmail("");
    setPassword("");
    request.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    request.mutate({ newEmail: newEmail.trim(), password }, { onSuccess: close });
  }

  return (
    <AccountSection title={t("account.email.title")}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-body text-label">{account.email}</p>
          {account.pendingEmail && (
            <p role="status" className="text-footnote text-label-secondary">
              {t("account.email.pending", { email: account.pendingEmail })}
            </p>
          )}
        </div>
        <Button variant="tinted" onClick={() => setIsChanging(true)}>
          {t("account.email.change")}
        </Button>
      </div>
      <Dialog
        open={isChanging}
        onClose={close}
        title={t("account.email.dialogTitle")}
        description={t("account.email.dialogDescription")}
        footer={
          <>
            <Button variant="plain" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="change-email-form" disabled={request.isPending}>
              {t("account.email.send")}
            </Button>
          </>
        }
      >
        <form id="change-email-form" onSubmit={submit} className="flex flex-col gap-5">
          <EmailField
            label={t("account.email.newEmail")}
            value={newEmail}
            onValueChange={setNewEmail}
            autoComplete="email"
            required
            data-autofocus
          />
          <PasswordField
            label={t("account.currentPassword")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            error={request.isError ? describeFormError(request.error) : undefined}
            required
          />
        </form>
      </Dialog>
    </AccountSection>
  );
}
