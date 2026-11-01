import { useState, type FormEvent } from "react";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { CopyButton } from "../design/CopyButton.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { confirmTwoFactor, type TwoFactorSetup } from "./account.api.js";
import { RecoveryCodes } from "./RecoveryCodes.js";

interface TwoFactorSetupDialogProps {
  setup: TwoFactorSetup;
  onClose: () => void;
  /** Two-factor is on; the recovery codes have been shown. */
  onDone: () => void;
}

/**
 * Scan the QR code (or type the key), enter the code the app shows, then keep the
 * recovery codes. Two-factor only turns on once a code matches, so nobody is locked out by
 * a scan that didn't work.
 */
export function TwoFactorSetupDialog({ setup, onClose, onDone }: TwoFactorSetupDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [isChecking, setIsChecking] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsChecking(true);
    setError(undefined);
    try {
      setRecoveryCodes((await confirmTwoFactor(code)).recoveryCodes);
    } catch (failure) {
      setError(describeFormError(failure));
    } finally {
      setIsChecking(false);
    }
  }

  if (recoveryCodes) {
    return (
      <Dialog
        open
        onClose={onDone}
        title={t("account.twoFactor.onTitle")}
        description={t("account.twoFactor.onDescription")}
        footer={
          <Button onClick={onDone} data-autofocus>
            {t("account.twoFactor.savedCodes")}
          </Button>
        }
      >
        <RecoveryCodes codes={recoveryCodes} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("account.twoFactor.setupTitle")}
      description={t("account.twoFactor.setupDescription")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="two-factor-form" disabled={isChecking}>
            {t("account.twoFactor.turnOn")}
          </Button>
        </>
      }
    >
      <form
        id="two-factor-form"
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-5"
      >
        <ol className="flex list-decimal flex-col gap-4 ps-5 text-body text-label marker:text-label-secondary">
          <li>
            <p>{t("account.twoFactor.stepScan")}</p>
            {/* The QR code is white with black squares in both schemes, as scanners expect. */}
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrCodeSvg)}`}
              alt={t("account.twoFactor.qrAlt")}
              className="mt-3 size-44 rounded-control bg-[white] p-2"
            />
            <p className="mt-3 text-footnote text-label-secondary">
              {t("account.twoFactor.manualKey")}
            </p>
            <div className="mt-1 flex items-center gap-2 rounded-control bg-fill p-2 ps-3">
              <code className="min-w-0 flex-1 font-mono text-footnote tracking-wider break-all text-label select-all">
                {setup.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
              <CopyButton value={setup.secret} label={t("account.twoFactor.copyKey")} />
            </div>
          </li>
          <li>
            <TextField
              label={t("account.twoFactor.stepCode")}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              error={error}
              required
              data-autofocus
            />
          </li>
        </ol>
      </form>
    </Dialog>
  );
}
