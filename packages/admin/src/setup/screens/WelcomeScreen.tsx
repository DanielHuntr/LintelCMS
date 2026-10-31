import { AppMark } from "../../design/AppMark.js";
import { t } from "../../i18n/strings.js";
import { WizardScreen } from "../WizardScreen.js";

/** The first thing a brand new Lintel shows: a hello and one button. */
export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <WizardScreen
      layout="hero"
      heroMark={<AppMark size="large" />}
      title={t("welcome.title")}
      subtitle={t("welcome.subtitle")}
      continueLabel={t("welcome.start")}
      onContinue={onContinue}
    />
  );
}
