import { Check } from "lucide-react";
import { Button } from "../../design/Button.js";
import { t } from "../../i18n/strings.js";
import { WizardScreen } from "../WizardScreen.js";

interface DoneScreenProps {
  name: string;
  /** "Built-in database · Blog, SEO tools" */
  summary: string;
  onContinue: () => void;
  /** Opens the template library, for people who'd rather not start from a blank site. */
  onStartFromTemplate?: () => void;
}

/** The last screen: a calm success mark, what was set up, and the way in. */
export function DoneScreen({ name, summary, onContinue, onStartFromTemplate }: DoneScreenProps) {
  return (
    <WizardScreen
      layout="hero"
      heroMark={<SuccessMark />}
      title={t("done.title", { name })}
      subtitle={summary}
      continueLabel={t("done.goToDashboard")}
      onContinue={onContinue}
    >
      {onStartFromTemplate && (
        <Button variant="plain" size="large" onClick={onStartFromTemplate}>
          {t("done.startFromTemplate")}
        </Button>
      )}
    </WizardScreen>
  );
}

/** Settles into place once (styles.css `settle-in`); reduced motion skips the movement. */
function SuccessMark() {
  return (
    <span className="flex size-20 items-center justify-center rounded-full bg-success/14 text-success motion-safe:animate-[settle-in_520ms_var(--ease-standard)_both]">
      <Check aria-hidden="true" strokeWidth={2.5} className="size-10" />
    </span>
  );
}
