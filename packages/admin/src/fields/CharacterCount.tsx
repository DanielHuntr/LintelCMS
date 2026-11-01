import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";

/**
 * "42 / 160" under a text field with a length limit. It turns orange near the limit.
 * It isn't announced on every keystroke (that would be noisy); the input's `maxLength`
 * stops typing at the limit, and screen readers can read the count when they reach it.
 */
export function CharacterCount({ length, maxLength }: { length: number; maxLength: number }) {
  const isNearLimit = length >= maxLength * 0.9;

  return (
    <p
      className={classNames(
        "ms-auto shrink-0 pt-px text-caption tabular-nums",
        isNearLimit ? "text-warning" : "text-label-tertiary",
      )}
    >
      {t("fields.characterCount", { count: length, max: maxLength })}
    </p>
  );
}
