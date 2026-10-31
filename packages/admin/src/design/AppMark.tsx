import { t } from "../i18n/strings.js";
import { classNames } from "./classNames.js";

interface AppMarkProps {
  size?: "small" | "large";
}

/**
 * The app's mark: the first letter of the app name under a short bar, like a lintel over a door.
 * It is text, not an image, so an agency that renames the app gets a matching mark for free.
 */
export function AppMark({ size = "small" }: AppMarkProps) {
  const isLarge = size === "large";

  return (
    <span
      aria-hidden="true"
      className={classNames(
        "inline-flex shrink-0 flex-col items-center justify-center bg-accent-fill text-on-accent",
        isLarge ? "size-14 gap-1 rounded-panel" : "size-7 gap-0.5 rounded-control",
      )}
    >
      <span
        className={classNames("rounded-full bg-on-accent", isLarge ? "h-1 w-6" : "h-0.5 w-3")}
      />
      <span
        className={classNames(
          "leading-none font-semibold",
          isLarge ? "text-[1.625rem]" : "text-[0.8125rem]",
        )}
      >
        {t("app.name").charAt(0)}
      </span>
    </span>
  );
}
