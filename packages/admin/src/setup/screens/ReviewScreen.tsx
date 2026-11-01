import { featuresForSiteType } from "@lintel/core/site-presets";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "../../design/Button.js";
import { t } from "../../i18n/strings.js";
import type { SetupAnswers } from "../setupAnswers.js";
import type { SetupStep } from "../setupRouting.js";
import { stepLabel } from "../StepIndicator.js";
import { WizardScreen } from "../WizardScreen.js";
import { siteTypeTitle } from "./SiteTypeScreen.js";

interface ReviewScreenProps {
  answers: SetupAnswers;
  /** False when DATABASE_URL chose the database, so there is nothing to review there. */
  showsDatabase: boolean;
  isConfirmed: boolean;
  onConfirmedChange: (isConfirmed: boolean) => void;
  onEdit: (step: SetupStep) => void;
  onFinish: () => void;
  onBack: () => void;
  isBusy: boolean;
  statusMessage: string;
}

/**
 * "Check your details": every answer, grouped by step, each with an Edit link back to it.
 * Passwords are hidden (the account's can be shown). Finishing needs the box ticked.
 */
export function ReviewScreen({
  answers,
  showsDatabase,
  isConfirmed,
  onConfirmedChange,
  onEdit,
  onFinish,
  onBack,
  isBusy,
  statusMessage,
}: ReviewScreenProps) {
  const checkbox = useRef<HTMLInputElement>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { account } = answers;
  const features = featuresForSiteType(answers.siteType).map(({ name }) => name);

  function finish() {
    if (!isConfirmed) {
      checkbox.current?.focus();
      return;
    }
    onFinish();
  }

  return (
    <WizardScreen
      title={t("review.title")}
      subtitle={t("review.subtitle")}
      onContinue={finish}
      onBack={onBack}
      continueLabel={t("review.finish")}
      continueBlockedReason={isConfirmed || isBusy ? undefined : t("review.confirmNeeded")}
      isBusy={isBusy}
      busyLabel={t("review.finishing")}
      statusMessage={statusMessage}
    >
      <div className="flex flex-col gap-4">
        {showsDatabase && (
          <ReviewSection step="database" onEdit={onEdit}>
            <DatabaseSummary answers={answers} />
          </ReviewSection>
        )}
        <ReviewSection step="account" onEdit={onEdit}>
          <Detail label={t("review.name")}>{account.name.trim()}</Detail>
          <Detail label={t("review.email")}>{account.email.trim()}</Detail>
          <Detail label={t("review.password")}>
            {account.password ? (
              <span className="flex items-center gap-2">
                <span className="font-mono break-all">
                  {isPasswordVisible ? account.password : "•".repeat(12)}
                </span>
                <Button
                  variant="plain"
                  size="small"
                  aria-pressed={isPasswordVisible}
                  aria-label={t("passwordField.show")}
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  {isPasswordVisible ? t("review.hidePassword") : t("review.showPassword")}
                </Button>
              </span>
            ) : (
              <span className="text-danger">{t("review.passwordMissing")}</span>
            )}
          </Detail>
        </ReviewSection>
        <ReviewSection step="site-name" onEdit={onEdit}>
          <Detail label={t("review.siteName")}>{answers.siteName.trim()}</Detail>
        </ReviewSection>
        <ReviewSection step="site-type" onEdit={onEdit}>
          <Detail label={t("review.siteType")}>{siteTypeTitle(answers.siteType)}</Detail>
          <Detail label={t("review.features")}>{features.join(", ")}</Detail>
        </ReviewSection>

        <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-card bg-surface p-4 text-body text-label">
          <input
            ref={checkbox}
            type="checkbox"
            name="confirmed"
            required
            checked={isConfirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
            className="size-5 shrink-0 accent-[var(--color-accent-fill)] focus-visible:focus-ring"
          />
          {t("review.confirm")}
        </label>
        {isBusy && (
          <p aria-live="polite" className="text-footnote text-label-secondary">
            {t("review.finishingDetail")}
          </p>
        )}
      </div>
    </WizardScreen>
  );
}

function DatabaseSummary({ answers }: { answers: SetupAnswers }) {
  if (answers.databaseKind === "built-in") {
    return <Detail label={t("review.builtIn")}>{t("review.builtInDetail")}</Detail>;
  }
  const { postgres } = answers;
  return (
    <>
      <Detail
        label={t("review.postgres")}
      >{`${postgres.host.trim()}:${postgres.port.trim()}`}</Detail>
      <Detail label={t("review.databaseName")}>
        {postgres.database.trim()}
        {postgres.createIfMissing && (
          <span className="block text-footnote text-label-secondary">
            {t("review.createDatabase")}
          </span>
        )}
      </Detail>
      <Detail label={t("review.user")}>{postgres.user.trim()}</Detail>
      <Detail label={t("review.databasePassword")}>
        {postgres.password ? "•".repeat(8) : t("review.noPassword")}
      </Detail>
    </>
  );
}

interface ReviewSectionProps {
  step: SetupStep;
  onEdit: (step: SetupStep) => void;
  children: ReactNode;
}

/** One step's answers in a card, headed by the step's name, with Edit on the right. */
function ReviewSection({ step, onEdit, children }: ReviewSectionProps) {
  const headingId = useId();
  const label = stepLabel(step);

  return (
    <section aria-labelledby={headingId} className="rounded-card bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-headline text-label">
          {label}
        </h2>
        <Button
          variant="plain"
          size="small"
          aria-label={t("review.editLabel", { section: label })}
          onClick={() => onEdit(step)}
        >
          {t("review.edit")}
        </Button>
      </div>
      <dl className="flex flex-col gap-1.5">{children}</dl>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-footnote text-label-secondary sm:w-40 sm:shrink-0 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-body text-label break-words">{children}</dd>
    </div>
  );
}
