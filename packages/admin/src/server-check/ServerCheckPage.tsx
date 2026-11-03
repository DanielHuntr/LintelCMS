import { CircleAlert, CircleCheck, CircleX, RefreshCw, type LucideIcon } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { CopyButton } from "../design/CopyButton.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import type { ServerCheck, ServerCheckReport } from "./serverCheck.api.js";
import { useServerCheck } from "./serverCheck.queries.js";

const looks: Record<ServerCheck["status"], { icon: LucideIcon; tone: Tone }> = {
  pass: { icon: CircleCheck, tone: "success" },
  warn: { icon: CircleAlert, tone: "warning" },
  fail: { icon: CircleX, tone: "danger" },
};

/**
 * /settings/server: whether the server Lintel runs on has what it needs, in plain words,
 * and what to ask the hosting company when it doesn't.
 */
export function ServerCheckPage() {
  const report = useServerCheck();

  return (
    <Page width="readable">
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("serverCheck.title")}
        subtitle={t("serverCheck.subtitle")}
        actions={
          <Button
            variant="tinted"
            icon={<RefreshCw aria-hidden="true" />}
            disabled={report.isFetching}
            onClick={() => void report.refetch()}
          >
            {t("serverCheck.checkAgain")}
          </Button>
        }
      />
      {report.isError && <LoadError error={report.error} onRetry={() => void report.refetch()} />}
      {report.isFetching ? (
        <LoadingRegion label={t("serverCheck.checking")}>
          <Skeleton className="h-72 rounded-card" />
        </LoadingRegion>
      ) : (
        report.data && <Report report={report.data} />
      )}
    </Page>
  );
}

function Report({ report }: { report: ServerCheckReport }) {
  return (
    <div className="flex flex-col gap-8">
      <GroupedList header={report.headline}>
        {report.checks.map((check) => (
          <GroupedListRow
            key={check.name}
            wrapsText
            icon={looks[check.status].icon}
            iconTone={looks[check.status].tone}
            label={check.name}
            description={check.detail}
            accessory={
              <span
                className={
                  check.status === "pass"
                    ? "sr-only"
                    : "shrink-0 text-footnote font-medium text-label-secondary"
                }
              >
                {t(`serverCheck.status.${check.status}`)}
              </span>
            }
          />
        ))}
      </GroupedList>
      {report.askHost.length > 0 && <AskYourHost questions={report.askHost} />}
    </div>
  );
}

function AskYourHost({ questions }: { questions: string[] }) {
  const message = [t("serverCheck.askHostGreeting"), "", ...questions.map((q) => `- ${q}`)].join(
    "\n",
  );
  return (
    <section aria-labelledby="ask-host" className="flex flex-col gap-1.5">
      <h2 id="ask-host" className="px-4 text-footnote font-medium text-label-secondary">
        {t("serverCheck.askHostTitle")}
      </h2>
      <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
        <ul className="flex list-disc flex-col gap-1 ps-5 text-body text-label">
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-footnote text-label-secondary">{t("serverCheck.askHostHint")}</p>
          <CopyButton value={message} label={t("serverCheck.copy")} />
        </div>
      </div>
    </section>
  );
}
