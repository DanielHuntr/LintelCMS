import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import {
  strengthAnnouncement,
  strengthLabel,
  tipText,
  type PasswordStrength,
  type PasswordStrengthLevel,
} from "./passwordStrength.js";
import { useSettledValue } from "./useSettledValue.js";

interface PasswordStrengthMeterProps {
  /** Undefined before anything is typed, or while the checker loads: the bar is empty. */
  strength: PasswordStrength | undefined;
  /** The text's id, for the password input's aria-describedby. */
  id: string;
}

const segments = [1, 2, 3, 4] as const;

const levelColours: Record<PasswordStrengthLevel, string> = {
  "too-weak": "bg-danger",
  weak: "bg-warning",
  good: "bg-success",
  strong: "bg-success",
};

/** How long typing must pause before the strength is read aloud. */
const announcementDelay = 900;

/**
 * Four segments and a label ("Weak · Add another word or two."). Colour is never the only
 * signal: the label always says the level in words.
 *
 * The visible text is not a live region, because it changes on every key. A separate,
 * hidden one speaks the result once typing pauses, and only when it changed.
 */
export function PasswordStrengthMeter({ strength, id }: PasswordStrengthMeterProps) {
  const filled = strength?.filledSegments ?? 0;
  const announcement = useSettledValue(
    strength ? strengthAnnouncement(strength) : "",
    announcementDelay,
  );

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden="true" className="grid grid-cols-4 gap-1.5" data-filled-segments={filled}>
        {segments.map((segment) => (
          <span
            key={segment}
            className={classNames(
              "h-1 rounded-full transition-colors duration-200 ease-standard motion-reduce:transition-none",
              strength && segment <= filled ? levelColours[strength.level] : "bg-fill-strong",
            )}
          />
        ))}
      </div>
      <p id={id} className="min-h-[1lh] text-footnote text-label-secondary">
        {strength ? (
          <>
            <span className="sr-only">{t("passwordStrength.label")}: </span>
            <span className="font-semibold text-label">{strengthLabel(strength.level)}</span>
            {strength.tip && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">. </span>
                {tipText(strength.tip)}
              </>
            )}
          </>
        ) : (
          t("passwordStrength.hint")
        )}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
