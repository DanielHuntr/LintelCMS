import { Database } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "../design/Button.js";
import { EmailField } from "../design/EmailField.js";
import { PasswordField } from "../design/PasswordField.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { Session } from "../session/session.api.js";
import {
  fieldForAccountMessage,
  looksLikeEmail,
  passwordIsLongEnough,
  readAccountDetails,
  type AccountErrors,
  type AccountField,
} from "./accountDetails.js";
import type { FirstAccountDetails, SetupApi, SetupCode } from "./setup.api.js";
import { stepProblemFor, type SetupFailure } from "./setupErrors.js";
import { focusField, StatusLine, StepPanel } from "./StepPanel.js";

interface AccountStepProps {
  api: Pick<SetupApi, "createFirstAccount">;
  setupCode: SetupCode;
  stepNumber?: { current: number; total: number };
  takesFocus: boolean;
  /** True when DATABASE_URL chose the database, so the database step was skipped. */
  usesEnvironmentDatabase: boolean;
  /** Back to the database step. Left out when there is no step to go back to. */
  onBack?: () => void;
  onCreated: (session: Session) => void;
  onInterrupted: (failure: Exclude<SetupFailure, { kind: "problem" | "unreachable" }>) => void;
}

/**
 * The first admin account. A password field with "Show password" instead of a confirm field,
 * a typo check on the email, and the email repeated by the button so a slip is easy to spot.
 */
export function AccountStep({
  api,
  setupCode,
  stepNumber,
  takesFocus,
  usesEnvironmentDatabase,
  onBack,
  onCreated,
  onInterrupted,
}: AccountStepProps) {
  const formElement = useRef<HTMLFormElement>(null);
  const [typed, setTyped] = useState<FirstAccountDetails>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<AccountErrors>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  function change(field: AccountField, value: string) {
    setTyped({ ...typed, [field]: value });
    setErrors({ ...errors, [field]: undefined });
  }

  function showErrors(newErrors: AccountErrors) {
    setErrors(newErrors);
    const firstField = Object.keys(newErrors)[0];
    if (firstField) focusField(formElement.current, firstField);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");

    const result = readAccountDetails(typed);
    if (result.errors) {
      showErrors(result.errors);
      return;
    }

    setIsCreating(true);
    try {
      onCreated(await api.createFirstAccount(result.details, setupCode));
    } catch (error) {
      setIsCreating(false);
      const problem = stepProblemFor(error, onInterrupted);
      if (!problem) return;
      const field = problem.code === "INVALID_REQUEST" && fieldForAccountMessage(problem.message);
      if (field) showErrors({ [field]: problem.message });
      else setStatusMessage(problem.message);
    }
  }

  const trimmedEmail = typed.email.trim();

  return (
    <StepPanel title={t("account.title")} stepNumber={stepNumber} takesFocus={takesFocus}>
      {usesEnvironmentDatabase && (
        <p className="-mt-2 mb-6 flex items-center gap-2 text-footnote text-label-secondary">
          <Database aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {t("account.environmentDatabase")}
        </p>
      )}

      <form ref={formElement} noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField
          label={t("account.name")}
          name="name"
          value={typed.name}
          onChange={(event) => change("name", event.target.value)}
          error={errors.name}
          autoComplete="name"
        />
        <EmailField
          label={t("account.email")}
          name="email"
          value={typed.email}
          onValueChange={(email) => change("email", email)}
          error={errors.email}
          autoComplete="email"
        />
        <PasswordField
          label={t("account.password")}
          name="password"
          value={typed.password}
          onChange={(event) => change("password", event.target.value)}
          error={errors.password}
          autoComplete="new-password"
          hint={
            passwordIsLongEnough(typed.password)
              ? t("account.passwordLooksGood")
              : t("account.passwordHint")
          }
          hintTone={passwordIsLongEnough(typed.password) ? "success" : "neutral"}
          announcesHint
        />

        <div className="mt-1 flex flex-col gap-3">
          {/* The light review: the address they'll sign in with, right where they press. */}
          {looksLikeEmail(trimmedEmail) && <EmailReview email={trimmedEmail} />}
          <Button type="submit" size="large" fullWidth disabled={isCreating}>
            {isCreating ? t("account.submitting") : t("account.submit")}
          </Button>
          {onBack && (
            <Button variant="plain" fullWidth onClick={onBack} disabled={isCreating}>
              {t("setup.back")}
            </Button>
          )}
        </div>
      </form>
      <StatusLine message={statusMessage} />
    </StepPanel>
  );
}

/** "You'll sign in with daniel@gmail.com", with the address in bold so a typo stands out. */
function EmailReview({ email }: { email: string }) {
  // Split the sentence around its placeholder, so translations can put the address anywhere.
  const [before, after] = t("account.confirmEmail").split("{email}");
  return (
    <p className="text-center text-footnote text-label-secondary">
      {before}
      <span className="font-semibold break-all text-label">{email}</span>
      {after}
    </p>
  );
}
