import { ChevronLeft, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode, type RefObject } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { DisplayTitle } from "../design/DisplayTitle.js";
import { t } from "../i18n/strings.js";

interface WizardScreenProps {
  /** The screen's one question. It is the page's h1. */
  title: string;
  /** At most one short sentence under the question. */
  subtitle?: string;
  /** A gentle note in a soft panel above the content, such as why a field is empty again. */
  notice?: string;
  children?: ReactNode;
  /** Called by the Continue button and by Enter in any field. */
  onContinue: () => void;
  continueLabel?: string;
  /**
   * Why Continue can't go ahead yet, such as a password that isn't strong enough. Continue
   * then looks unavailable and this sentence sits beside it, but it can still be pressed:
   * pressing it shows what to fix, rather than silently doing nothing.
   */
  continueBlockedReason?: string;
  /** While true, Continue shows `busyLabel` and can't be pressed again. */
  isBusy?: boolean;
  busyLabel?: string;
  /** Left out on screens with nowhere to go back to. */
  onBack?: () => void;
  /** A problem that doesn't belong to one field, such as the server not answering. */
  statusMessage?: string;
  /** The main input, focused when the screen appears. Without one, the question is focused. */
  focusTarget?: RefObject<HTMLElement | null>;
  /** "wide" makes room for a grid of tiles. */
  width?: "regular" | "wide";
  /**
   * "hero" centres everything and puts the button under the text, for the first and last
   * screens. "question" keeps the buttons in a bar along the bottom.
   */
  layout?: "question" | "hero";
  /** Shown above the question on hero screens, such as the app mark or a success mark. */
  heroMark?: ReactNode;
}

/**
 * One screen of a full-screen wizard: a big question, a sentence, the screen's own content
 * and Continue. Everything is one form, so Enter continues from any field.
 */
export function WizardScreen({
  title,
  subtitle,
  notice,
  children,
  onContinue,
  continueLabel = t("setup.continue"),
  continueBlockedReason,
  isBusy = false,
  busyLabel,
  onBack,
  statusMessage = "",
  focusTarget,
  width = "regular",
  layout = "question",
  heroMark,
}: WizardScreenProps) {
  const headingId = useId();
  const blockedReasonId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const isHero = layout === "hero";

  // A new screen replaces the button that was just pressed, so focus would otherwise fall
  // back to the top of the page. Land on the screen's input, or failing that its question.
  useEffect(() => {
    (focusTarget?.current ?? heading.current)?.focus();
  }, [focusTarget]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isBusy) onContinue();
  }

  const blockedReason = continueBlockedReason && (
    <p id={blockedReasonId} className="text-footnote text-label-secondary">
      {continueBlockedReason}
    </p>
  );

  const continueButton = (
    <Button
      type="submit"
      size="extra-large"
      disabled={isBusy}
      aria-disabled={continueBlockedReason ? true : undefined}
      aria-describedby={continueBlockedReason ? blockedReasonId : undefined}
      icon={
        isBusy ? (
          <LoaderCircle
            aria-hidden="true"
            strokeWidth={2.25}
            className="motion-safe:animate-spin"
          />
        ) : undefined
      }
      className={classNames(
        isHero ? "min-w-56" : "flex-1 sm:min-w-44 sm:flex-none",
        // Calmer than the usual faded disabled look: the button is working, not unavailable.
        "disabled:opacity-80",
        "aria-disabled:opacity-40 aria-disabled:hover:brightness-100",
      )}
    >
      {isBusy && busyLabel ? busyLabel : continueLabel}
    </Button>
  );

  return (
    <form
      noValidate
      aria-labelledby={headingId}
      onSubmit={handleSubmit}
      className={classNames(
        "flex min-h-dvh flex-col px-6",
        isHero ? "items-center justify-center py-24" : "pt-28 pb-40 sm:pt-[max(6.5rem,13vh)]",
      )}
    >
      <div
        className={classNames(
          "mx-auto flex w-full flex-col [view-transition-name:wizard-screen]",
          width === "wide" ? "max-w-[760px]" : "max-w-[540px]",
          isHero && "items-center text-center",
        )}
      >
        {heroMark && <div className="mb-8">{heroMark}</div>}
        <DisplayTitle id={headingId} ref={heading} tabIndex={-1}>
          {title}
        </DisplayTitle>
        {subtitle && (
          <p className="mt-3 text-headline font-normal text-pretty text-label-secondary">
            {subtitle}
          </p>
        )}
        {notice && (
          <p className="mt-6 rounded-card bg-accent/8 px-4 py-3 text-footnote text-label">
            {notice}
          </p>
        )}
        {children && <div className={isHero ? "mt-8" : "mt-10"}>{children}</div>}

        {/* Always rendered, so screen readers are already listening when a message arrives. */}
        <p role="status" className="mt-6 text-footnote text-danger empty:mt-0">
          {statusMessage}
        </p>

        {isHero && (
          <div className="mt-10 flex flex-col items-center gap-3">
            {continueButton}
            {blockedReason}
          </div>
        )}
      </div>

      {!isHero && (
        <ActionBar onBack={onBack} isBusy={isBusy} width={width} note={blockedReason}>
          {continueButton}
        </ActionBar>
      )}
    </form>
  );
}

interface ActionBarProps {
  onBack?: () => void;
  isBusy: boolean;
  width: "regular" | "wide";
  /** A sentence about Continue, shown above the buttons. */
  note?: ReactNode;
  children: ReactNode;
}

/** Back and Continue, pinned to the bottom so they stay in reach on a phone. */
function ActionBar({ onBack, isBusy, width, note, children }: ActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 bg-background/85 backdrop-blur-xl">
      <div
        className={classNames(
          "mx-auto flex w-full flex-wrap items-center gap-3 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pt-5 sm:pb-8",
          width === "wide" ? "max-w-[808px]" : "max-w-[588px]",
        )}
      >
        {note && <div className="w-full text-end">{note}</div>}
        {onBack && (
          <Button
            variant="plain"
            size="large"
            onClick={onBack}
            disabled={isBusy}
            icon={<ChevronLeft aria-hidden="true" strokeWidth={2} />}
            className="-ms-3"
          >
            {t("setup.back")}
          </Button>
        )}
        <div className="flex flex-1 justify-end">{children}</div>
      </div>
    </div>
  );
}
