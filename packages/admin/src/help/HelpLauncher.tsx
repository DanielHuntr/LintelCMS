import { useRouterState } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { t } from "../i18n/strings.js";
import { helpSlugForPath } from "./helpTopics.js";

const loadHelpPanel = () => import("./HelpPanel.js");

// The panel brings every help page with it, so it loads on its own, after the admin.
const HelpPanel = lazy(async () => ({ default: (await loadHelpPanel()).HelpPanel }));

/**
 * The "?" button at the top right of every admin screen, and the help panel it opens with
 * the page for that screen (see helpTopics.ts).
 */
export function HelpLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Fetch the panel once the admin is idle, so help opens at once and keeps working if the
  // connection drops later.
  useEffect(() => {
    const preload = () => void loadHelpPanel().catch(() => undefined);
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(preload, { timeout: 5000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(preload, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  function close() {
    setIsOpen(false);
    button.current?.focus();
  }

  // z-30 keeps the button above sticky toolbars (z-20), such as the entry editor's, so it
  // can always be clicked; dialogs (z-40) still cover it.
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={t("help.open")}
        title={t("help.open")}
        className="fixed top-4 right-4 z-30 flex size-9 items-center justify-center rounded-full bg-surface text-label-secondary shadow-float hairline-ring transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring motion-safe:active:scale-95"
      >
        <CircleHelp aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </button>
      {isOpen && (
        <Suspense
          fallback={
            <p
              role="status"
              className="fixed top-4 right-16 z-30 rounded-full bg-surface px-3 py-2 text-footnote text-label-secondary shadow-float"
            >
              {t("help.loading")}
            </p>
          }
        >
          <HelpPanel id={panelId} slug={helpSlugForPath(pathname)} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
