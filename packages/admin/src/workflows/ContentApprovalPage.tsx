import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { describeError } from "../api/describeError.js";
import { BackLink } from "../design/BackLink.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { RoleSelect } from "./RecipientsField.js";
import { useCatalogue, useContentApproval, useSetContentApproval } from "./workflows.queries.js";
import type { ContentApprovalSetting } from "./workflows.types.js";

/** /automations/approval: which collections need a review before publishing, and who reviews. */
export function ContentApprovalPage() {
  const settings = useContentApproval();
  const catalogue = useCatalogue();
  const change = useSetContentApproval();
  const canChange = useCan("automations:update");

  function update(setting: ContentApprovalSetting, changes: Partial<ContentApprovalSetting>) {
    const next = { ...setting, ...changes };
    change.mutate({
      collection: next.collection,
      required: next.required,
      reviewerRole: next.reviewerRole,
      publishWhenApproved: next.publishWhenApproved,
    });
  }

  return (
    <>
      <BackLink to="/automations">{t("automations.title")}</BackLink>
      <LargeTitle title={t("approval.title")} subtitle={t("approval.subtitle")} />
      {settings.isError && (
        <LoadError error={settings.error} onRetry={() => void settings.refetch()} />
      )}
      {settings.isPending && (
        <LoadingRegion label={t("approval.loading")}>
          <Skeleton className="h-24 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {settings.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            icon={BadgeCheck}
            title={t("approval.emptyTitle")}
            description={t("approval.emptyDescription")}
          />
        </div>
      )}
      {settings.data && settings.data.length > 0 && (
        <div className="flex max-w-2xl flex-col gap-3">
          {change.isError && (
            <p role="alert" className="text-footnote text-danger">
              {describeError(change.error)}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {settings.data.map((setting) => (
              <li
                key={setting.collection}
                className="flex flex-col gap-4 rounded-card bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-headline text-label">{setting.collectionName}</h2>
                  <Toggle
                    label={`${t("approval.required")}: ${setting.collectionName}`}
                    labelVisibility="hidden"
                    checked={setting.required}
                    disabled={!canChange || change.isPending}
                    onCheckedChange={(required) => update(setting, { required })}
                  />
                </div>
                <p className="-mt-3 text-footnote text-label-secondary">{t("approval.required")}</p>
                {setting.required && (
                  <div className="flex flex-col gap-4">
                    <RoleSelect
                      label={t("approval.reviewerLabel", { collection: setting.collectionName })}
                      roles={catalogue.data?.roles ?? []}
                      value={setting.reviewerRole}
                      onChange={(reviewerRole) => update(setting, { reviewerRole })}
                    />
                    <Toggle
                      label={t("approval.publishWhenApproved")}
                      checked={setting.publishWhenApproved}
                      disabled={!canChange || change.isPending}
                      onCheckedChange={(publishWhenApproved) =>
                        update(setting, { publishWhenApproved })
                      }
                    />
                    {setting.workflowId && (
                      <Link
                        to="/automations/$workflowId"
                        params={{ workflowId: setting.workflowId }}
                        className="text-footnote text-accent underline-offset-2 hover:underline focus-visible:focus-ring"
                      >
                        {t("approval.openWorkflow")}
                      </Link>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="px-1 text-footnote text-label-secondary">{t("approval.footer")}</p>
        </div>
      )}
    </>
  );
}
