import { useRef, useState } from "react";
import { EmailField } from "../../design/EmailField.js";
import { PasswordField } from "../../design/PasswordField.js";
import { TextField } from "../../design/TextField.js";
import { t } from "../../i18n/strings.js";
import { NewPasswordField } from "../../password-strength/NewPasswordField.js";
import type { PasswordStrength } from "../../password-strength/passwordStrength.js";
import { usePasswordStrength } from "../../password-strength/usePasswordStrength.js";
import {
  confirmPasswordProblem,
  continueBlockedReason,
  type AccountField,
  type AccountForm,
  type AccountProblems,
} from "../accountDetails.js";
import { WizardScreen } from "../WizardScreen.js";

interface CreateAccountScreenProps {
  form: AccountForm;
  onChange: (changes: Partial<AccountForm>) => void;
  errors: AccountProblems;
  /** Called with the strength the meter shows, so Continue checks the same answer. */
  onContinue: (strength: PasswordStrength | undefined) => void;
  onBack: () => void;
  statusMessage: string;
  /** A sentence above the fields, such as "type your password again" after a reload. */
  notice?: string;
}

/**
 * "Create your account": name, email (with the "Did you mean gmail.com?" check), a new
 * password with its strength meter and suggestion, and the password again. Nothing is
 * created yet: the account is made when setup finishes.
 */
export function CreateAccountScreen({
  form,
  onChange,
  errors,
  onContinue,
  onBack,
  statusMessage,
  notice,
}: CreateAccountScreenProps) {
  const nameInput = useRef<HTMLInputElement>(null);
  const strength = usePasswordStrength(form.password, form.name, form.email);
  const [hasTouchedConfirmation, setHasTouchedConfirmation] = useState(false);

  function change(field: AccountField, value: string) {
    onChange({ [field]: value });
  }

  return (
    <WizardScreen
      title={t("createAccount.title")}
      subtitle={t("createAccount.subtitle")}
      focusTarget={nameInput}
      onContinue={() => onContinue(strength)}
      onBack={onBack}
      continueBlockedReason={continueBlockedReason(form.password, strength)}
      statusMessage={statusMessage}
      notice={notice}
    >
      <div className="flex flex-col gap-6">
        <TextField
          ref={nameInput}
          fieldSize="large"
          label={t("name.label")}
          name="name"
          value={form.name}
          onChange={(event) => change("name", event.target.value)}
          error={errors.name}
          autoComplete="name"
        />
        <EmailField
          fieldSize="large"
          label={t("email.label")}
          name="email"
          value={form.email}
          onValueChange={(email) => change("email", email)}
          error={errors.email}
          autoComplete="email"
        />
        <NewPasswordField
          label={t("password.label")}
          name="password"
          value={form.password}
          onValueChange={(password) => change("password", password)}
          onSuggestion={(password) => {
            onChange({ password, confirmPassword: password });
            setHasTouchedConfirmation(true);
          }}
          strength={strength}
          error={errors.password}
        />
        <PasswordField
          fieldSize="large"
          label={t("confirmPassword.label")}
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={(event) => {
            change("confirmPassword", event.target.value);
            setHasTouchedConfirmation(true);
          }}
          onBlur={() => setHasTouchedConfirmation(true)}
          autoComplete="new-password"
          {...confirmationFeedback(form, errors, hasTouchedConfirmation)}
        />
      </div>
    </WizardScreen>
  );
}

/**
 * "Passwords match" or "These don't match yet", once the person has typed in the field (or
 * left it). Read aloud politely: it only changes when the answer does, not on every key.
 */
function confirmationFeedback(form: AccountForm, errors: AccountProblems, hasTouched: boolean) {
  if (errors.confirmPassword) return { error: errors.confirmPassword };
  if (!hasTouched || !form.confirmPassword) return { announcesHint: true };
  const problem = confirmPasswordProblem(form.password, form.confirmPassword);
  return problem
    ? { hint: problem, announcesHint: true }
    : { hint: t("confirmPassword.matches"), hintTone: "success" as const, announcesHint: true };
}
