import { Check, Copy, Dices } from "lucide-react";
import { useId, useRef, useState, type Ref } from "react";
import { Button } from "../design/Button.js";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter.js";
import type { PasswordStrength } from "./passwordStrength.js";

interface NewPasswordFieldProps {
  label: string;
  name: string;
  value: string;
  onValueChange: (password: string) => void;
  /** From usePasswordStrength, so the screen can use the same answer to allow Continue. */
  strength: PasswordStrength | undefined;
  /** Called with a suggested passphrase. Defaults to filling this field. */
  onSuggestion?: (password: string) => void;
  error?: string;
  fieldSize?: "regular" | "large";
  ref?: Ref<HTMLInputElement>;
}

type CopyState = "idle" | "copied" | "failed";

/**
 * Choosing a new password: show/hide, a strength meter with one tip, and "Suggest a password",
 * which fills in a passphrase like "maple-orbit-cactus-river-42", shows it and offers to copy
 * it. autocomplete="new-password" stays, so the browser's own generator still offers itself.
 */
export function NewPasswordField({
  label,
  name,
  value,
  onValueChange,
  strength,
  onSuggestion = onValueChange,
  error,
  fieldSize = "large",
  ref,
}: NewPasswordFieldProps) {
  const meterId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const [suggestion, setSuggestion] = useState<string>();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyButton = useRef<HTMLButtonElement>(null);
  const isShowingSuggestion = suggestion !== undefined && suggestion === value;

  async function suggestPassword() {
    // Loaded on first use: the word list is only needed by people who ask for a suggestion.
    const { generatePassphrase } = await import("./passphrase.js");
    const passphrase = generatePassphrase();
    setSuggestion(passphrase);
    setCopyState("idle");
    setIsVisible(true);
    onSuggestion(passphrase);
    // The Copy button appears with the suggestion; it's the natural next step.
    window.requestAnimationFrame(() => copyButton.current?.focus());
  }

  async function copySuggestion() {
    if (!suggestion) return;
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PasswordField
        ref={ref}
        fieldSize={fieldSize}
        label={label}
        name={name}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        error={error}
        describedBy={meterId}
        autoComplete="new-password"
        isVisible={isVisible}
        onVisibleChange={setIsVisible}
      />
      <PasswordStrengthMeter id={meterId} strength={value ? strength : undefined} />

      <div className="flex flex-col items-start gap-2">
        <Button
          variant="tinted"
          size="small"
          icon={<Dices aria-hidden="true" strokeWidth={2} />}
          onClick={() => void suggestPassword()}
        >
          {t("passwordSuggestion.suggest")}
        </Button>
        {/* Always rendered, so screen readers hear the line about saving it when it appears. */}
        <div aria-live="polite" className="w-full">
          {isShowingSuggestion && (
            <SuggestionNote
              copyState={copyState}
              onCopy={() => void copySuggestion()}
              copyButtonRef={copyButton}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface SuggestionNoteProps {
  copyState: CopyState;
  onCopy: () => void;
  copyButtonRef: Ref<HTMLButtonElement>;
}

/** "Save it in your password manager" with a Copy button, in a soft panel under the field. */
function SuggestionNote({ copyState, onCopy, copyButtonRef }: SuggestionNoteProps) {
  const isCopied = copyState === "copied";

  return (
    <div className="flex flex-col gap-3 rounded-card bg-accent/8 p-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-footnote text-label">
        {copyState === "failed"
          ? t("passwordSuggestion.copyFailed")
          : t("passwordSuggestion.saveIt")}
      </p>
      <Button
        ref={copyButtonRef}
        size="small"
        aria-label={isCopied ? t("passwordSuggestion.copied") : t("passwordSuggestion.copyLabel")}
        icon={
          isCopied ? (
            <Check aria-hidden="true" strokeWidth={2.5} />
          ) : (
            <Copy aria-hidden="true" strokeWidth={2} />
          )
        }
        onClick={onCopy}
      >
        {isCopied ? t("passwordSuggestion.copied") : t("passwordSuggestion.copy")}
      </Button>
    </div>
  );
}
