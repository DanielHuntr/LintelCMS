import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { Session } from "../session/session.api.js";

interface TwoFactorStepProps {
  completeSignIn: (answer: { code: string } | { recoveryCode: string }) => Promise<Session>;
  onSignedIn: (session: Session) => void;
  /** Back to the password, for a challenge that ran out. */
  onStartAgain: () => void;
}

/** The second step of signing in: the code from the app, or a recovery code instead. */
export function TwoFactorStep({ completeSignIn, onSignedIn, onStartAgain }: TwoFactorStepProps) {
  const [usesRecoveryCode, setUsesRecoveryCode] = useState(false);
  const [answer, setAnswer] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mustStartAgain, setMustStartAgain] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsChecking(true);
    setErrorMessage("");
    try {
      onSignedIn(
        await completeSignIn(usesRecoveryCode ? { recoveryCode: answer } : { code: answer }),
      );
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t("signIn.unreachable"));
      setMustStartAgain(error instanceof ApiError && error.code === "SIGN_IN_EXPIRED");
      setIsChecking(false);
    }
  }

  return (
    <>
      <form onSubmit={(event) => void submit(event)} className="mt-10 flex w-full flex-col gap-6">
        <TextField
          key={usesRecoveryCode ? "recovery" : "code"}
          fieldSize="large"
          label={usesRecoveryCode ? t("signIn.recoveryCode") : t("signIn.code")}
          hint={usesRecoveryCode ? t("signIn.recoveryCodeHint") : t("signIn.codeHint")}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          inputMode={usesRecoveryCode ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoCapitalize="off"
          autoFocus
          required
        />
        {mustStartAgain ? (
          <Button type="button" size="extra-large" fullWidth onClick={onStartAgain}>
            {t("signIn.startAgain")}
          </Button>
        ) : (
          <Button type="submit" size="extra-large" fullWidth disabled={isChecking}>
            {isChecking ? t("signIn.checking") : t("signIn.verify")}
          </Button>
        )}
        <Button
          type="button"
          variant="plain"
          onClick={() => {
            setUsesRecoveryCode(!usesRecoveryCode);
            setAnswer("");
          }}
        >
          {usesRecoveryCode ? t("signIn.useApp") : t("signIn.useRecoveryCode")}
        </Button>
      </form>
      <p role="status" className="mt-5 text-footnote text-danger empty:mt-0">
        {errorMessage}
      </p>
    </>
  );
}
