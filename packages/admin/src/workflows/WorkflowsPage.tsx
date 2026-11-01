import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Plus, Workflow as WorkflowIcon } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { describeError } from "../api/describeError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Badge } from "../design/Badge.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { summariseWorkflow } from "./describeSteps.js";
import { RunStatusBadge } from "./RunStatusBadge.js";
import { TemplateGallery } from "./TemplateGallery.js";
import { useDescribeContext } from "./useDescribeContext.js";
import type { WorkflowTemplate } from "./workflowTemplates.js";
import { useSetContentApproval, useWorkflows } from "./workflows.queries.js";

/** /automations: the workflows there are, examples to start from, and content approval. */
export function WorkflowsPage() {
  const workflows = useWorkflows();
  const canChange = useCan("workflows:update");
  const describeContext = useDescribeContext();
  const navigate = useNavigate();
  const setApproval = useSetContentApproval();
  const now = useNow();
  const session = useSession();

  function startFromTemplate(template: WorkflowTemplate) {
    if (template.kind === "content-approval") {
      setApproval.mutate(
        {
          collection: "pages",
          required: true,
          reviewerRole: "super-admin",
          publishWhenApproved: true,
        },
        { onSuccess: () => void navigate({ to: "/automations/approval" }) },
      );
      return;
    }
    void navigate({ to: "/automations/new", search: { template: template.id } });
  }

  const newButton = canChange && (
    <LinkButton
      to="/automations/new"
      search={{ template: undefined }}
      icon={<Plus aria-hidden="true" />}
    >
      {t("automations.new")}
    </LinkButton>
  );

  return (
    <>
      <LargeTitle
        title={t("automations.title")}
        subtitle={t("automations.subtitle")}
        actions={newButton}
      />

      {workflows.isError && (
        <LoadError error={workflows.error} onRetry={() => void workflows.refetch()} />
      )}
      {workflows.isPending && (
        <LoadingRegion label={t("automations.loading")}>
          <Skeleton className="h-14 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}

      <div className="flex max-w-3xl flex-col gap-10">
        {workflows.data?.length === 0 && (
          <div className="rounded-card bg-surface">
            <EmptyState
              size="page"
              icon={WorkflowIcon}
              title={t("automations.emptyTitle")}
              description={t("automations.emptyDescription")}
            />
          </div>
        )}

        {workflows.data && workflows.data.length > 0 && (
          <GroupedList header={t("automations.yours")}>
            {workflows.data.map((workflow) => (
              <GroupedListRow
                key={workflow.id}
                icon={workflow.purpose ? BadgeCheck : WorkflowIcon}
                iconTone={workflow.enabled ? "accent" : "neutral"}
                label={workflow.name}
                description={summariseWorkflow(workflow, describeContext)}
                wrapsText
                detail={
                  workflow.lastRun
                    ? t("automations.lastRun", {
                        when: formatRelativeTime(workflow.lastRun.createdAt, now),
                      })
                    : t("automations.neverRun")
                }
                accessory={
                  workflow.enabled ? (
                    workflow.lastRun && <RunStatusBadge status={workflow.lastRun.status} />
                  ) : (
                    <Badge tone="neutral">{t("automations.off")}</Badge>
                  )
                }
                to={`/automations/${encodeURIComponent(workflow.id)}`}
              />
            ))}
          </GroupedList>
        )}

        <GroupedList>
          <GroupedListRow
            icon={BadgeCheck}
            iconTone="success"
            label={t("automations.approvalLink")}
            description={t("automations.approvalLinkDescription")}
            to="/automations/approval"
          />
        </GroupedList>

        {canChange && (
          <section aria-labelledby="automation-templates" className="flex flex-col gap-3">
            <h2 id="automation-templates" className="text-headline text-label">
              {t("automations.templatesTitle")}
            </h2>
            <TemplateGallery person={session.user} onUse={startFromTemplate} />
            {setApproval.isError && (
              <p role="alert" className="text-footnote text-danger">
                {describeError(setApproval.error)}
              </p>
            )}
          </section>
        )}

        <p className="text-footnote text-label-secondary">
          {t("automations.developerHint")}{" "}
          <Link
            to="/help"
            search={{ topic: "using/automations", anchor: undefined }}
            className="text-accent underline-offset-2 hover:underline focus-visible:focus-ring"
          >
            {t("automations.developerDocs")}
          </Link>
        </p>
      </div>
    </>
  );
}
