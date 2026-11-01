import { Plus, Shapes } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { useCanChangeContentModel } from "../content-model-sync/contentModelSync.queries.js";
import { ManagedInCodeBanner } from "../content-model-sync/ManagedInCodeBanner.js";
import { ModelSyncNotices } from "../content-model-sync/ModelSyncNotices.js";
import { BackLink } from "../design/BackLink.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useBlueprints } from "./blueprints.queries.js";
import { Page } from "../design/Page.js";

/** /settings/content-types: every content type, and a way to make a new one. */
export function ContentTypesPage() {
  const blueprints = useBlueprints();
  const canCreate = useCanChangeContentModel("blueprints:update");

  const newButton = canCreate && (
    <LinkButton to="/settings/content-types/new" icon={<Plus aria-hidden="true" />}>
      {t("contentTypes.new")}
    </LinkButton>
  );

  return (
    <Page width="wide">
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("contentTypes.title")}
        subtitle={t("contentTypes.subtitle")}
        actions={blueprints.data?.length === 0 ? undefined : newButton}
      />
      <ModelSyncNotices />
      <ManagedInCodeBanner />

      {blueprints.isError && (
        <LoadError error={blueprints.error} onRetry={() => void blueprints.refetch()} />
      )}

      {blueprints.isPending && (
        <LoadingRegion label={t("contentTypes.loading")}>
          <div className="flex flex-col gap-px overflow-hidden rounded-card">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-14 rounded-none" />
            ))}
          </div>
        </LoadingRegion>
      )}

      {blueprints.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Shapes}
            title={t("contentTypes.emptyTitle")}
            description={t("contentTypes.emptyDescription")}
            action={newButton}
          />
        </div>
      )}

      {blueprints.data && blueprints.data.length > 0 && (
        <GroupedList footer={t("contentTypes.footer")}>
          {blueprints.data.map((blueprint) => (
            <GroupedListRow
              key={blueprint.id}
              icon={Shapes}
              label={blueprint.name}
              description={t("builder.fieldCount", { count: blueprint.fields.length })}
              to={`/settings/content-types/${encodeURIComponent(blueprint.handle)}`}
            />
          ))}
        </GroupedList>
      )}
    </Page>
  );
}
