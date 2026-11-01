import type { ComponentProps } from "react";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import { passwordIsLongEnough } from "../setup/accountDetails.js";
import { PasswordStrengthSlot } from "./PasswordStrengthSlot.js";

type NewPasswordFieldProps = Omit<
  ComponentProps<typeof PasswordField>,
  "value" | "onChange" | "autoComplete" | "hint" | "hintTone"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A field for choosing a new password: the length rule as a hint that turns green, so
 * browsers and password managers know to offer a strong one (`autocomplete="new-password"`).
 */
export function NewPasswordField({ value, onValueChange, ...fieldProps }: NewPasswordFieldProps) {
  const isLongEnough = passwordIsLongEnough(value);
  return (
    <div className="flex flex-col gap-2">
      <PasswordField
        {...fieldProps}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        autoComplete="new-password"
        hint={isLongEnough ? t("password.looksGood") : t("password.hint")}
        hintTone={isLongEnough ? "success" : "neutral"}
        announcesHint
        minLength={12}
      />
      <PasswordStrengthSlot password={value} />
    </div>
  );
}
