import { CheckCircle2, TriangleAlert } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { CopyButton } from "../design/CopyButton.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import type { PolicyHelper } from "./privacy.api.js";
import { usePolicyHelper } from "./privacy.queries.js";

/**
 * Settings → Privacy → Privacy policy helper: a draft "What this site collects", written from
 * what the site uses, to copy into the privacy page, and a check of that page. Always said
 * to be a starting point, not legal advice.
 */
export function PolicyHelperPage() {
  const policy = usePolicyHelper();

  return (
    <Page width="readable">
      <BackLink to="/settings/privacy">{t("privacy.title")}</BackLink>
      <LargeTitle
        title={t("privacy.policy.title")}
        subtitle={t("privacy.policy.subtitle")}
        actions={
          policy.data && <CopyButton value={policy.data.draft} label={t("privacy.policy.copy")} />
        }
      />
      {policy.isError && <LoadError error={policy.error} onRetry={() => void policy.refetch()} />}
      {policy.isPending && (
        <LoadingRegion label={t("privacy.policy.loading")}>
          <Skeleton className="h-80 rounded-card" />
        </LoadingRegion>
      )}
      {policy.data && (
        <div className="flex flex-col gap-8">
          <p className="rounded-card bg-warning/10 px-4 py-3 text-footnote text-label">
            {t("privacy.policy.notAdvice")}
          </p>
          <section aria-labelledby="policy-draft" className="flex flex-col gap-1.5">
            <h2 id="policy-draft" className="px-4 text-footnote font-medium text-label-secondary">
              {t("privacy.policy.draftHeader")}
            </h2>
            <div className="flex flex-col gap-4 rounded-card bg-surface p-4">
              {policy.data.sections.map((section) => (
                <div key={section.id} className="flex flex-col gap-1">
                  <h3 className="text-body font-medium text-label">{section.heading}</h3>
                  <p className="text-body text-label-secondary">{section.text}</p>
                </div>
              ))}
            </div>
          </section>
          <PageCheck policy={policy.data} />
        </div>
      )}
    </Page>
  );
}

function PageCheck({ policy }: { policy: PolicyHelper }) {
  const page = policy.privacyPage;
  const allMentioned = page !== null && policy.notMentioned.length === 0;
  const Icon = allMentioned ? CheckCircle2 : TriangleAlert;
  const message = !page
    ? t("privacy.policy.noPage")
    : allMentioned
      ? t("privacy.policy.allMentioned", { page: page.title })
      : t("privacy.policy.missing", { page: page.title, names: policy.notMentioned.join(", ") });
  return (
    <section aria-labelledby="policy-check" className="flex flex-col gap-1.5">
      <h2 id="policy-check" className="px-4 text-footnote font-medium text-label-secondary">
        {t("privacy.policy.checkHeader")}
      </h2>
      <div className="flex items-start gap-3 rounded-card bg-surface p-4">
        <Icon
          aria-hidden="true"
          className={`mt-0.5 size-5 shrink-0 ${allMentioned ? "text-success" : "text-warning"}`}
        />
        <p className="text-body text-label">{message}</p>
      </div>
      {page && (
        <p className="px-4 text-footnote text-label-secondary">{t("privacy.policy.checkFooter")}</p>
      )}
    </section>
  );
}
