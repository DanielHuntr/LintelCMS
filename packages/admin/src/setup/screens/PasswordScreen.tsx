import { useRef } from "react";
import { PasswordField } from "../../design/PasswordField.js";
import { t } from "../../i18n/strings.js";
import { passwordIsLongEnough } from "../accountDetails.js";
import { WizardScreen } from "../WizardScreen.js";

interface PasswordScreenProps {
  password: string;
  onPasswordChange: (password: string) => void;
  /** Repeated in the sentence under the question, as a last chance to spot a typo. */
  email: string;
  error?: string;
  onContinue: () => void;
  onBack: () => void;
  isBusy: boolean;
  statusMessage: string;
}

/** "Create a password". Continuing creates the account. */
export function PasswordScreen({
  password,
  onPasswordChange,
  email,
  error,
  onContinue,
  onBack,
  isBusy,
  statusMessage,
}: PasswordScreenProps) {
  const input = useRef<HTMLInputElement>(null);
  const isLongEnough = passwordIsLongEnough(password);

  return (
    <WizardScreen
      title={t("password.title")}
      subtitle={t("password.subtitle", { email: email.trim() })}
      focusTarget={input}
      onContinue={onContinue}
      onBack={onBack}
      continueLabel={t("password.submit")}
      isBusy={isBusy}
      busyLabel={t("password.submitting")}
      statusMessage={statusMessage}
    >
      <PasswordField
        ref={input}
        fieldSize="large"
        label={t("password.label")}
        name="password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        error={error}
        autoComplete="new-password"
        hint={isLongEnough ? t("password.looksGood") : t("password.hint")}
        hintTone={isLongEnough ? "success" : "neutral"}
        announcesHint
      />
    </WizardScreen>
  );
}
