import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { t } from "../i18n/strings.js";
import { TextField } from "./TextField.js";

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, "type" | "trailingAccessory">;

/**
 * A password field with a "Show password" button. Seeing what you typed is kinder than
 * typing it twice, so screens use this instead of a "Confirm password" field.
 */
export function PasswordField(fieldProps: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <TextField
      {...fieldProps}
      type={isVisible ? "text" : "password"}
      // A visible password is still a password: keep phones from "correcting" it.
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      trailingAccessory={
        <button
          type="button"
          // The label stays the same and aria-pressed says whether it's on, as for any toggle button.
          aria-label={t("passwordField.show")}
          aria-pressed={isVisible}
          title={t("passwordField.show")}
          onClick={() => setIsVisible(!isVisible)}
          className="flex size-8 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring"
        >
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
        </button>
      }
    />
  );
}
