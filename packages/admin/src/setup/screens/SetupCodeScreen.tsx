import { useRef } from "react";
import { t } from "../../i18n/strings.js";
import { SetupCodeInput } from "../SetupCodeInput.js";
import { WizardScreen } from "../WizardScreen.js";

interface SetupCodeScreenProps {
  code: string;
  onCodeChange: (code: string) => void;
  error?: string;
  onContinue: () => void;
  onBack: () => void;
}

/** Only when setting up from another computer: proves the person can see Lintel's terminal. */
export function SetupCodeScreen({
  code,
  onCodeChange,
  error,
  onContinue,
  onBack,
}: SetupCodeScreenProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <WizardScreen
      title={t("setupCode.title")}
      subtitle={t("setupCode.subtitle")}
      focusTarget={input}
      onContinue={onContinue}
      onBack={onBack}
    >
      <SetupCodeInput
        ref={input}
        label={t("setupCode.label")}
        value={code}
        onValueChange={onCodeChange}
        error={error}
      />
    </WizardScreen>
  );
}
