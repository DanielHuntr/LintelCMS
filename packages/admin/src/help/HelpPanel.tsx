import { findHelpPage } from "@lintel/docs/help";
import { ArrowUpRight, ChevronLeft, X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent } from "react";
import { inertOutside } from "../design/inertOutside.js";
import { useIsNarrowScreen } from "../design/useIsNarrowScreen.js";
import { t } from "../i18n/strings.js";
import { fullDocsUrl } from "./docsLinks.js";
import { HelpArticle } from "./HelpArticle.js";
import { HelpTopicList } from "./HelpTopicList.js";
import { LintelVersion } from "../updates/LintelVersion.js";

interface HelpPanelProps {
  id: string;
  /** The page for the current screen. The panel goes back to it when the screen changes. */
  slug: string;
  onClose: () => void;
}

/** What the panel shows: a page (with an optional heading to scroll to) or the topic list. */
type HelpView = { kind: "page"; slug: string; anchor?: string } | { kind: "topics" };

const iconButtonClasses =
  "flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-secondary transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring";

/**
 * The help beside the page. On a laptop it isn't modal: people can read and keep working, so
 * the page behind stays usable. On a phone it covers the page, so there it is a modal dialog:
 * the page behind is inert and Escape closes it from anywhere (LINTEL-A11Y-030). Focus moves
 * to its heading on open and on each new page, so screen readers announce where they are.
 * Loaded lazily (see HelpLauncher).
 */
export function HelpPanel({ id, slug, onClose }: HelpPanelProps) {
  const [history, setHistory] = useState<HelpView[]>([{ kind: "page", slug }]);
  const [screenSlug, setScreenSlug] = useState(slug);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const panel = useRef<HTMLElement>(null);
  const isModal = useIsNarrowScreen();
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!isModal || !panel.current) return;
    const restorePage = inertOutside(panel.current);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      restorePage();
    };
  }, [isModal]);

  // A new screen starts the panel again from that screen's page.
  if (slug !== screenSlug) {
    setScreenSlug(slug);
    setHistory([{ kind: "page", slug }]);
  }

  const view = history.at(-1) ?? { kind: "topics" };
  const page = view.kind === "page" ? findHelpPage(view.slug) : undefined;
  const title = page?.title ?? t(view.kind === "topics" ? "help.topicsTitle" : "help.missingTitle");

  // Each new page (or going back) starts at the top, with focus on its heading.
  useEffect(() => {
    const current = history.at(-1);
    heading.current?.focus({ preventScroll: true });
    if (current?.kind !== "page" || !current.anchor) body.current?.scrollTo?.({ top: 0 });
  }, [history]);

  function open(next: HelpView) {
    setHistory((previous) => [...previous, next]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <aside
      ref={panel}
      id={id}
      aria-labelledby={headingId}
      {...(isModal ? { role: "dialog", "aria-modal": true } : {})}
      onKeyDown={handleKeyDown}
      className="fixed inset-y-3 inset-e-3 z-30 flex w-[min(400px,calc(100vw-24px))] flex-col rounded-panel bg-surface text-label shadow-float hairline-ring motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-standard motion-safe:starting:translate-x-4 motion-safe:rtl:starting:-translate-x-4 starting:opacity-0"
    >
      <header className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-3 hairline-bottom">
        {history.length > 1 && (
          <button
            type="button"
            onClick={() => setHistory((previous) => previous.slice(0, -1))}
            aria-label={t("help.back")}
            title={t("help.back")}
            className={iconButtonClasses}
          >
            <ChevronLeft aria-hidden="true" strokeWidth={2.25} className="size-4" />
          </button>
        )}
        <p className="flex-1 text-footnote font-medium text-label-secondary">
          {t("help.panelLabel")}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("help.close")}
          title={t("help.close")}
          className={iconButtonClasses}
        >
          <X aria-hidden="true" strokeWidth={2.25} className="size-4" />
        </button>
      </header>

      <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
        <h2
          id={headingId}
          ref={heading}
          tabIndex={-1}
          className="text-title text-label outline-none"
        >
          {title}
        </h2>
        {page?.description && (
          <p className="mt-1 mb-4 text-footnote text-label-secondary">{page.description}</p>
        )}
        {page ? (
          <HelpArticle
            page={page}
            anchor={view.kind === "page" ? view.anchor : undefined}
            onOpenPage={(nextSlug, anchor) => open({ kind: "page", slug: nextSlug, anchor })}
          />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {view.kind === "page" && (
              <p className="text-body text-label-secondary">{t("help.missingDescription")}</p>
            )}
            <HelpTopicList
              headingLevel={3}
              onOpenPage={(nextSlug) => open({ kind: "page", slug: nextSlug })}
            />
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 hairline-top">
        {view.kind === "topics" ? (
          <LintelVersion className="px-1 text-footnote text-label-tertiary" />
        ) : (
          <button
            type="button"
            onClick={() => open({ kind: "topics" })}
            className="rounded-control px-1 text-footnote font-medium text-accent focus-visible:focus-ring"
          >
            {t("help.allTopics")}
          </button>
        )}
        <a
          href={fullDocsUrl(page?.slug ?? "using")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-control px-1 text-footnote font-medium text-accent focus-visible:focus-ring"
        >
          {t("help.fullDocs")}
          <ArrowUpRight aria-hidden="true" strokeWidth={2} className="size-3.5" />
          <span className="sr-only">{t("help.newTab")}</span>
        </a>
      </footer>
    </aside>
  );
}
