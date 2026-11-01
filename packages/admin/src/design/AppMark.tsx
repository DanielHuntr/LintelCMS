import { useBranding } from "../branding/brandingStore.js";
import { t } from "../i18n/strings.js";
import { classNames } from "./classNames.js";

interface AppMarkProps {
  size?: "small" | "large";
}

/**
 * The app's small square mark: the agency's own when it's branded (Settings → Branding),
 * otherwise Lintel's bird on a branch, drawn in white on the accent colour. The bird
 * comes from brand/lintel-mark.svg at the repository root; keep the two the same.
 */
export const BIRD_PATH =
  "M45.26 38.15 L19.54 59.82 L55.75 53.72 L65.23 45.60 L65.57 45.94 L55.75 54.94 L30.37 60.02 L26.33 65.33 L6.00 64.05 L8.71 67.34 L22.80 68.22 L13.45 80.12 L37.49 69.14 L94.00 72.69 L91.97 69.45 L78.67 68.61 L89.26 61.85 L72.72 68.24 L45.26 66.52 L53.68 66.20 L76.40 53.72 L78.77 27.66 L85.54 19.88 L70.98 21.57 L61.85 30.37 Z M72.237 24.818 A1.320 1.320 0 1 0 74.877 24.818 A1.320 1.320 0 1 0 72.237 24.818 Z";

export function AppMark({ size = "small" }: AppMarkProps) {
  const isLarge = size === "large";
  const { mark } = useBranding();

  if (mark) {
    return (
      <img
        src={mark}
        alt=""
        className={classNames(
          "shrink-0 object-contain",
          isLarge ? "size-14 rounded-panel" : "size-7 rounded-control",
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={t("app.name")}
      className={classNames(
        "inline-flex shrink-0 items-center justify-center bg-accent-fill text-on-accent",
        isLarge ? "size-14 rounded-panel" : "size-7 rounded-control",
      )}
    >
      <svg viewBox="0 0 100 100" className={isLarge ? "size-11" : "size-[22px]"} focusable="false">
        <path fill="currentColor" fillRule="evenodd" d={BIRD_PATH} />
      </svg>
    </span>
  );
}
