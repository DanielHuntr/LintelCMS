import { useRef } from "react";
import { TextField } from "../../design/TextField.js";
import { t } from "../../i18n/strings.js";
import { WizardScreen } from "../WizardScreen.js";

interface NameScreenProps {
  name: string;
  onNameChange: (name: string) => void;
  error?: string;
  onContinue: () => void;
  onBack: () => void;
}

/** "What should we call you?" */
export function NameScreen({ name, onNameChange, error, onContinue, onBack }: NameScreenProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <WizardScreen
      title={t("name.title")}
      subtitle={t("name.subtitle")}
      focusTarget={input}
      onContinue={onContinue}
      onBack={onBack}
    >
      <TextField
        ref={input}
        fieldSize="large"
        label={t("name.label")}
        name="name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        error={error}
        autoComplete="name"
      />
    </WizardScreen>
  );
}
