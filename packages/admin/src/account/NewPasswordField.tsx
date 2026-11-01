import { type ComponentProps, useId } from "react";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import { PasswordStrengthSlot } from "./PasswordStrengthSlot.js";

type NewPasswordFieldProps = Omit<
  ComponentProps<typeof PasswordField>,
  "value" | "onChange" | "autoComplete" | "hint" | "hintTone"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Whose password it is, so the strength meter counts their name and email against it. */
  personName?: string;
  personEmail?: string;
};

/**
 * A field for choosing a new password: the length rule as a hint, and the strength meter
 * below it (which says the level in words and gives one tip). `autocomplete="new-password"` lets browsers and password managers
 * offer a strong one.
 */
export function NewPasswordField({
  value,
  onValueChange,
  personName,
  personEmail,
  ...fieldProps
}: NewPasswordFieldProps) {
  const meterId = useId();
  return (
    <div className="flex flex-col gap-2">
      <PasswordField
        {...fieldProps}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        autoComplete="new-password"
        hint={t("passwordStrength.hint")}
        minLength={12}
        describedBy={meterId}
      />
      <PasswordStrengthSlot
        id={meterId}
        password={value}
        personName={personName}
        personEmail={personEmail}
      />
    </div>
  );
}
