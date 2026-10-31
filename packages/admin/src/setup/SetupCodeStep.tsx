import { useState, type FormEvent } from "react";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { StepPanel } from "./StepPanel.js";

interface SetupCodeStepProps {
  initialCode: string;
  /** Set when the API turned the code down, so the person can fix it here. */
  error?: string;
  onContinue: (code: string) => void;
  takesFocus: boolean;
}

/**
 * Asked only when setting up from another computer. There is no request here: the code is
 * kept in memory and sent with the next step, which says if it's wrong.
 */
export function SetupCodeStep({ initialCode, error, onContinue, takesFocus }: SetupCodeStepProps) {
  const [code, setCode] = useState(initialCode);
  const [missingCode, setMissingCode] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setMissingCode(true);
      return;
    }
    onContinue(trimmedCode);
  }

  return (
    <StepPanel
      title={t("setupCode.title")}
      description={t("setupCode.description")}
      takesFocus={takesFocus}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField
          label={t("setupCode.label")}
          name="setupCode"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setMissingCode(false);
          }}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          hint={t("setupCode.hint")}
          error={missingCode ? t("setupCode.missing") : error}
        />
        <Button type="submit" size="large" fullWidth>
          {t("setup.continue")}
        </Button>
      </form>
    </StepPanel>
  );
}
