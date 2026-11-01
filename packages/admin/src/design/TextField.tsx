import { Check } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { classNames } from "./classNames.js";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Always visible above the field. */
  label: string;
  /** Extra guidance under the field, e.g. "At least 12 characters". */
  hint?: string;
  /** "success" shows the hint in green with a tick, for a hint that confirms a rule is met. */
  hintTone?: "neutral" | "success";
  /**
   * Reads changes to the hint aloud. Use it for hints that react to typing, such as a
   * password rule turning into "Looks good", so people who can't see the change still hear it.
   */
  announcesHint?: boolean;
  /** Replaces the hint and marks the field invalid when set. */
  error?: string;
  /** A small button inside the right edge of the field, such as "Show password". */
  trailingAccessory?: ReactNode;
  /** Ids of more text that describes the field, read after the hint or error, e.g. a strength meter. */
  describedBy?: string;
  /** "large" is for full-screen flows such as setup, where one field fills the screen. */
  fieldSize?: "regular" | "large";
  ref?: Ref<HTMLInputElement>;
}

/** A labelled text input. Hints and errors are linked with aria-describedby so screen readers read them. */
export function TextField({
  label,
  hint,
  hintTone = "neutral",
  announcesHint = false,
  error,
  trailingAccessory,
  describedBy,
  fieldSize = "regular",
  className,
  id,
  ...inputProps
}: TextFieldProps) {
  const isLarge = fieldSize === "large";
  const generatedId = useId();
  // An id can be passed in when something else needs to find the input, e.g. to focus it.
  const inputId = id ?? generatedId;
  const messageId = useId();
  const message = error ?? hint;
  const isSuccess = !error && hintTone === "success";

  return (
    <div className={classNames("flex flex-col", isLarge ? "gap-2" : "gap-1.5", className)}>
      <label
        htmlFor={inputId}
        className={classNames(
          "font-medium",
          isLarge ? "text-footnote text-label-secondary" : "text-footnote text-label",
        )}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [message ? messageId : undefined, describedBy].filter(Boolean).join(" ") || undefined
          }
          className={classNames(
            "w-full bg-fill text-label",
            isLarge
              ? "h-14 rounded-card px-4 text-headline font-normal"
              : "h-10 rounded-control px-3 text-body",
            "placeholder:text-label-tertiary transition-shadow duration-150 ease-standard",
            error
              ? "ring-1 ring-danger focus:focus-ring-danger"
              : "focus:focus-ring focus:outline-offset-0",
            trailingAccessory !== undefined && (isLarge ? "pr-14" : "pr-11"),
          )}
          {...inputProps}
        />
        {trailingAccessory !== undefined && (
          <div
            className={classNames(
              "absolute inset-y-0 flex items-center",
              isLarge ? "right-2" : "right-1",
            )}
          >
            {trailingAccessory}
          </div>
        )}
      </div>
      {/* A field that announces its hint keeps the region, so the first message is heard too. */}
      {(message || announcesHint) && (
        <p
          id={messageId}
          aria-live={announcesHint ? "polite" : undefined}
          className={classNames(
            "flex items-start gap-1 text-footnote empty:sr-only",
            error ? "text-danger" : isSuccess ? "text-success" : "text-label-secondary",
          )}
        >
          {isSuccess && <Check aria-hidden="true" strokeWidth={2.5} className="mt-0.5 size-3.5" />}
          {message}
        </p>
      )}
    </div>
  );
}
