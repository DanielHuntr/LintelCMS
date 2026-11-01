import { useRef } from "react";
import { TextField } from "../../design/TextField.js";
import { t } from "../../i18n/strings.js";
import { WizardScreen } from "../WizardScreen.js";

interface SiteNameScreenProps {
  siteName: string;
  onSiteNameChange: (siteName: string) => void;
  error?: string;
  onContinue: () => void;
  onBack: () => void;
}

/** "What's your site called?" One field; the name can be changed any time later. */
export function SiteNameScreen({
  siteName,
  onSiteNameChange,
  error,
  onContinue,
  onBack,
}: SiteNameScreenProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <WizardScreen
      title={t("siteName.title")}
      subtitle={t("siteName.subtitle")}
      focusTarget={input}
      onContinue={onContinue}
      onBack={onBack}
    >
      <TextField
        ref={input}
        fieldSize="large"
        label={t("siteName.label")}
        name="siteName"
        placeholder={t("siteName.placeholder")}
        value={siteName}
        onChange={(event) => onSiteNameChange(event.target.value)}
        error={error}
        autoComplete="off"
      />
    </WizardScreen>
  );
}
