import { useRef } from "react";
import { EmailField } from "../../design/EmailField.js";
import { t } from "../../i18n/strings.js";
import { WizardScreen } from "../WizardScreen.js";

interface EmailScreenProps {
  email: string;
  onEmailChange: (email: string) => void;
  error?: string;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * "What's your email?" with a typo check: "gmai.com" is how the first person to try Lintel
 * got locked out, so a slip in the domain is offered a one-click fix.
 */
export function EmailScreen({ email, onEmailChange, error, onContinue, onBack }: EmailScreenProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <WizardScreen
      title={t("email.title")}
      subtitle={t("email.subtitle")}
      focusTarget={input}
      onContinue={onContinue}
      onBack={onBack}
    >
      <EmailField
        ref={input}
        fieldSize="large"
        label={t("email.label")}
        name="email"
        value={email}
        onValueChange={onEmailChange}
        error={error}
        autoComplete="email"
      />
    </WizardScreen>
  );
}
