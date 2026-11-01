import { useState, type FormEvent } from "react";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import { useSession } from "../session/SessionContext.js";
import { passwordIsLongEnough } from "../setup/accountDetails.js";
import { useChangePassword } from "./account.queries.js";
import { AccountSection } from "./AccountSection.js";
import { NewPasswordField } from "./NewPasswordField.js";

/** Changing your password, which also signs out your other devices. */
export function PasswordSection() {
  const [isChanging, setIsChanging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [result, setResult] = useState<string>("");
  const change = useChangePassword();
  const { user } = useSession();

  function close() {
    setIsChanging(false);
    setCurrentPassword("");
    setNewPassword("");
    change.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: ({ endedSessions }) => {
          setResult(t("account.password.changed", { count: endedSessions }));
          close();
        },
      },
    );
  }

  return (
    <AccountSection
      title={t("account.password.title")}
      description={t("account.password.description")}
    >
      <div className="flex items-center justify-between gap-4">
        <p role="status" className="text-footnote text-success">
          {result}
        </p>
        <Button variant="tinted" onClick={() => setIsChanging(true)}>
          {t("account.password.change")}
        </Button>
      </div>
      <Dialog
        open={isChanging}
        onClose={close}
        title={t("account.password.dialogTitle")}
        footer={
          <>
            <Button variant="plain" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              form="change-password-form"
              disabled={change.isPending || !passwordIsLongEnough(newPassword)}
            >
              {t("account.password.save")}
            </Button>
          </>
        }
      >
        <form id="change-password-form" onSubmit={submit} className="flex flex-col gap-5">
          <PasswordField
            label={t("account.currentPassword")}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            error={change.isError ? describeFormError(change.error) : undefined}
            required
            data-autofocus
          />
          <NewPasswordField
            label={t("account.password.newPassword")}
            value={newPassword}
            onValueChange={setNewPassword}
            personName={user.name}
            personEmail={user.email}
            required
          />
        </form>
      </Dialog>
    </AccountSection>
  );
}
