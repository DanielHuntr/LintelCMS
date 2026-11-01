import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { describeFormError } from "../api/describeError.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { PasswordField } from "../design/PasswordField.js";
import { t, tCount } from "../i18n/strings.js";
import { startTwoFactorSetup, type TwoFactorSetup } from "./account.api.js";
import {
  accountKeys,
  useCreateRecoveryCodes,
  useDisableTwoFactor,
  useTwoFactor,
} from "./account.queries.js";
import { AccountSection } from "./AccountSection.js";
import { RecoveryCodes } from "./RecoveryCodes.js";
import { TwoFactorSetupDialog } from "./TwoFactorSetupDialog.js";

type PasswordAction = "disable" | "codes";

/** Two-factor authentication with an authenticator app, and its recovery codes. */
export function TwoFactorSection() {
  const status = useTwoFactor();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [startError, setStartError] = useState<string>();
  const [passwordAction, setPasswordAction] = useState<PasswordAction | null>(null);
  const [password, setPassword] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const disable = useDisableTwoFactor();
  const createCodes = useCreateRecoveryCodes();
  const passwordMutation = passwordAction === "disable" ? disable : createCodes;

  async function start() {
    setStartError(undefined);
    try {
      setSetup(await startTwoFactorSetup());
    } catch (error) {
      setStartError(describeFormError(error));
    }
  }

  async function finishSetup() {
    setSetup(null);
    await queryClient.invalidateQueries({ queryKey: accountKeys.all() });
    // Someone whose role requires two-factor can use the rest of the admin now.
    await router.invalidate();
  }

  function closePasswordDialog() {
    setPasswordAction(null);
    setPassword("");
    disable.reset();
    createCodes.reset();
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (passwordAction === "disable") {
      disable.mutate(password, { onSuccess: closePasswordDialog });
    } else {
      createCodes.mutate(password, {
        onSuccess: ({ recoveryCodes }) => {
          closePasswordDialog();
          setNewCodes(recoveryCodes);
        },
      });
    }
  }

  const data = status.data;
  return (
    <AccountSection
      title={t("account.twoFactor.title")}
      description={t("account.twoFactor.description")}
    >
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {data.enabled ? (
              <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-6 text-success" />
            ) : (
              <ShieldOff
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-6 text-label-tertiary"
              />
            )}
            <div>
              <p className="flex items-center gap-2 text-body text-label">
                {data.enabled ? t("account.twoFactor.isOn") : t("account.twoFactor.isOff")}
                {data.required && (
                  <Badge tone="warning">{t("account.twoFactor.requiredBadge")}</Badge>
                )}
              </p>
              {data.enabled && (
                <p className="text-footnote text-label-secondary">
                  {tCount(
                    {
                      one: "account.twoFactor.codesLeftOne",
                      other: "account.twoFactor.codesLeftOther",
                    },
                    data.recoveryCodesLeft,
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {data.enabled ? (
              <>
                <Button variant="tinted" onClick={() => setPasswordAction("codes")}>
                  {t("account.twoFactor.newCodes")}
                </Button>
                {!data.required && (
                  <Button variant="destructive" onClick={() => setPasswordAction("disable")}>
                    {t("account.twoFactor.turnOff")}
                  </Button>
                )}
              </>
            ) : (
              <Button onClick={() => void start()}>{t("account.twoFactor.setUp")}</Button>
            )}
          </div>
        </div>
      )}
      {startError && (
        <p role="alert" className="text-footnote text-danger">
          {startError}
        </p>
      )}

      {setup && (
        <TwoFactorSetupDialog
          setup={setup}
          onClose={() => setSetup(null)}
          onDone={() => void finishSetup()}
        />
      )}
      <Dialog
        open={passwordAction !== null}
        onClose={closePasswordDialog}
        title={
          passwordAction === "disable"
            ? t("account.twoFactor.turnOffTitle")
            : t("account.twoFactor.newCodesTitle")
        }
        description={
          passwordAction === "disable"
            ? t("account.twoFactor.turnOffDescription")
            : t("account.twoFactor.newCodesDescription")
        }
        footer={
          <>
            <Button variant="plain" onClick={closePasswordDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              form="two-factor-password-form"
              variant={passwordAction === "disable" ? "destructive" : "filled"}
              disabled={passwordMutation.isPending}
            >
              {passwordAction === "disable"
                ? t("account.twoFactor.turnOff")
                : t("account.twoFactor.makeCodes")}
            </Button>
          </>
        }
      >
        <form id="two-factor-password-form" onSubmit={submitPassword}>
          <PasswordField
            label={t("account.currentPassword")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            error={passwordMutation.isError ? describeFormError(passwordMutation.error) : undefined}
            required
            data-autofocus
          />
        </form>
      </Dialog>
      <Dialog
        open={newCodes !== null}
        onClose={() => setNewCodes(null)}
        title={t("account.twoFactor.newCodesReadyTitle")}
        footer={
          <Button onClick={() => setNewCodes(null)} data-autofocus>
            {t("account.twoFactor.savedCodes")}
          </Button>
        }
      >
        {newCodes && <RecoveryCodes codes={newCodes} />}
      </Dialog>
    </AccountSection>
  );
}
