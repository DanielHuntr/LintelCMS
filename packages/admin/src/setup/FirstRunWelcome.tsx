import { useLocation, useNavigate } from "@tanstack/react-router";
import { CircleCheck, X } from "lucide-react";
import { t } from "../i18n/strings.js";

/**
 * A one-time "You're all set" at the top of the dashboard, straight after setup. It lives in
 * the history entry's state rather than the URL, so a shared or bookmarked link never shows it.
 */
export function FirstRunWelcome() {
  const welcomeEmail = useLocation({ select: (location) => location.state.welcomeEmail });
  const navigate = useNavigate();

  if (!welcomeEmail) return null;

  function dismiss() {
    // Clearing it from this history entry means Back or a reload won't bring it back.
    void navigate({
      to: ".",
      replace: true,
      state: (state) => ({ ...state, welcomeEmail: undefined }),
    });
  }

  return (
    <div role="status" className="mb-8 flex items-start gap-3 rounded-card bg-surface p-5">
      <CircleCheck
        aria-hidden="true"
        strokeWidth={1.75}
        className="mt-0.5 size-6 shrink-0 text-success"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-headline text-label">{t("welcome.title")}</h2>
        <p className="text-body text-label-secondary">
          {t("welcome.body", { email: welcomeEmail })}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("welcome.dismiss")}
        title={t("welcome.dismiss")}
        className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring"
      >
        <X aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
      </button>
    </div>
  );
}
