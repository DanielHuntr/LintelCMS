import { Plus, UploadCloud } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useCreatePublishTarget, usePublishTargets } from "./publishing.queries.js";
import { PublishTargetCard } from "./PublishTargetCard.js";
import { PublishTargetDialog } from "./PublishTargetDialog.js";

/**
 * /settings/publishing: hosting the website is published to as files, for people whose
 * host can't run Lintel itself.
 */
export function PublishingPage() {
  const targets = usePublishTargets();
  const create = useCreatePublishTarget();
  const canChange = useCan("settings:update");
  const [isAdding, setIsAdding] = useState(false);

  const addButton = canChange && (
    <Button icon={<Plus aria-hidden="true" />} onClick={() => setIsAdding(true)}>
      {t("publishing.add")}
    </Button>
  );

  return (
    <Page width="readable">
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("publishing.title")}
        subtitle={t("publishing.subtitle")}
        actions={targets.data?.length === 0 ? undefined : addButton}
      />
      {targets.isError && (
        <LoadError error={targets.error} onRetry={() => void targets.refetch()} />
      )}
      {targets.isPending && (
        <LoadingRegion label={t("publishing.loading")}>
          <Skeleton className="h-40 rounded-card" />
        </LoadingRegion>
      )}
      {targets.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={UploadCloud}
            title={t("publishing.emptyTitle")}
            description={t("publishing.emptyDescription")}
            action={addButton}
          />
        </div>
      )}
      <div className="flex flex-col gap-6">
        {targets.data?.map((target) => (
          <PublishTargetCard key={target.id} target={target} canChange={canChange} />
        ))}
      </div>
      {isAdding && (
        <PublishTargetDialog
          isSaving={create.isPending}
          error={create.error}
          onClose={() => {
            create.reset();
            setIsAdding(false);
          }}
          onSubmit={(input) => create.mutate(input, { onSuccess: () => setIsAdding(false) })}
        />
      )}
    </Page>
  );
}
