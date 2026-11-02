import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { useQueryClient } from "@tanstack/react-query";
import { Fingerprint, KeyRound, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { describeFormError } from "../api/describeError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { Dialog } from "../design/Dialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { PasswordField } from "../design/PasswordField.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { type Passkey, passkeyCreationOptions, savePasskey } from "./account.api.js";
import { accountKeys, usePasskeys, useRemovePasskey } from "./account.queries.js";
import { AccountSection } from "./AccountSection.js";

/**
 * Passkeys: signing in with a fingerprint, face or device PIN instead of a password.
 * Optional; the password keeps working.
 */
export function PasskeysSection() {
  const passkeys = usePasskeys();
  const remove = useRemovePasskey();
  const queryClient = useQueryClient();
  const now = useNow();
  const [isNaming, setIsNaming] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const isSupported = browserSupportsWebAuthn();

  async function add(event: FormEvent) {
    event.preventDefault();
    setIsAdding(true);
    setError(undefined);
    try {
      const optionsJSON = await passkeyCreationOptions(password);
      const response = await startRegistration({ optionsJSON });
      await savePasskey(name.trim() || t("account.passkeys.defaultName"), response);
      await queryClient.invalidateQueries({ queryKey: accountKeys.passkeys() });
      setIsNaming(false);
      setName("");
      setPassword("");
    } catch (failure) {
      // Cancelling the browser's own passkey prompt lands here too; say so plainly.
      setError(
        failure instanceof Error && failure.name === "NotAllowedError"
          ? t("account.passkeys.cancelled")
          : describeFormError(failure),
      );
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <AccountSection
      title={t("account.passkeys.title")}
      description={t("account.passkeys.description")}
    >
      {passkeys.data && passkeys.data.length > 0 && (
        <GroupedList>
          {passkeys.data.map((passkey) => (
            <GroupedListRow
              key={passkey.id}
              icon={KeyRound}
              iconTone="success"
              label={passkey.name}
              description={
                passkey.lastUsedAt
                  ? t("account.passkeys.lastUsed", {
                      when: formatRelativeTime(passkey.lastUsedAt, now),
                    })
                  : t("account.passkeys.neverUsed")
              }
              accessory={
                <Button
                  variant="plain"
                  size="small"
                  aria-label={t("account.passkeys.remove", { name: passkey.name })}
                  icon={<Trash2 aria-hidden="true" strokeWidth={2} />}
                  onClick={() => setRemoving(passkey)}
                />
              }
            />
          ))}
        </GroupedList>
      )}
      <div className="flex items-center justify-between gap-4">
        <p className="text-footnote text-label-secondary">
          {isSupported ? "" : t("account.passkeys.unsupported")}
        </p>
        <Button
          variant="tinted"
          icon={<Fingerprint aria-hidden="true" strokeWidth={2} />}
          disabled={!isSupported}
          onClick={() => setIsNaming(true)}
        >
          {t("account.passkeys.add")}
        </Button>
      </div>

      <Dialog
        open={isNaming}
        onClose={() => {
          setIsNaming(false);
          setError(undefined);
          setPassword("");
        }}
        title={t("account.passkeys.addTitle")}
        description={t("account.passkeys.addDescription")}
        footer={
          <>
            <Button variant="plain" onClick={() => setIsNaming(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="passkey-form" disabled={isAdding}>
              {t("account.passkeys.continue")}
            </Button>
          </>
        }
      >
        <form
          id="passkey-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => void add(event)}
        >
          <TextField
            label={t("account.passkeys.name")}
            hint={t("account.passkeys.nameHint")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            data-autofocus
          />
          <PasswordField
            label={t("account.currentPassword")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            error={error}
            required
          />
        </form>
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        title={t("account.passkeys.removeTitle", { name: removing?.name ?? "" })}
        message={t("account.passkeys.removeMessage")}
        confirmLabel={t("account.passkeys.removeConfirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, { onSettled: () => setRemoving(null) });
        }}
      />
    </AccountSection>
  );
}
