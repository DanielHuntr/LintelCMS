import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BookCopy, Plus } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { NameSheet } from "../content/NameSheet.js";
import { useCanChangeContentModel } from "../content-model-sync/contentModelSync.queries.js";
import { ManagedInCodeBanner } from "../content-model-sync/ManagedInCodeBanner.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { createFieldset } from "./fieldsets.api.js";
import { fieldsetKeys, useFieldsets } from "./fieldsets.queries.js";

/** /build/fieldsets: saved sets of fields that content types reuse, and a way to make one. */
export function FieldsetsPage() {
  const fieldsets = useFieldsets();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canCreate = useCanChangeContentModel("blueprints:update");
  const [isCreating, setIsCreating] = useState(false);

  const newButton = canCreate && (
    <Button icon={<Plus aria-hidden="true" />} onClick={() => setIsCreating(true)}>
      {t("fieldsets.new")}
    </Button>
  );

  return (
    <Page width="wide">
      <BackLink to="/build/content-types">{t("contentTypes.title")}</BackLink>
      <LargeTitle
        title={t("fieldsets.title")}
        subtitle={t("fieldsets.subtitle")}
        actions={fieldsets.data?.length === 0 ? undefined : newButton}
      />
      <ManagedInCodeBanner />

      {fieldsets.isError && (
        <LoadError error={fieldsets.error} onRetry={() => void fieldsets.refetch()} />
      )}
      {fieldsets.isPending && (
        <LoadingRegion label={t("fieldsets.loading")}>
          <Skeleton className="h-28 rounded-card" />
        </LoadingRegion>
      )}
      {fieldsets.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={BookCopy}
            title={t("fieldsets.emptyTitle")}
            description={t("fieldsets.emptyDescription")}
            action={newButton}
          />
        </div>
      )}
      {fieldsets.data && fieldsets.data.length > 0 && (
        <GroupedList footer={t("fieldsets.footer")}>
          {fieldsets.data.map((fieldset) => (
            <GroupedListRow
              key={fieldset.id}
              icon={BookCopy}
              label={fieldset.name}
              description={[
                t("builder.fieldCount", { count: fieldset.fields.length }),
                fieldset.usedBy.length > 0
                  ? t("fieldsets.usedBy", { names: fieldset.usedBy.join(", ") })
                  : t("fieldsets.unused"),
              ].join(" · ")}
              to={`/build/fieldsets/${encodeURIComponent(fieldset.handle)}`}
            />
          ))}
        </GroupedList>
      )}

      <NameSheet
        open={isCreating}
        title={t("fieldsets.new")}
        description={t("fieldsets.newDescription")}
        nameLabel={t("fieldsets.name")}
        submitLabel={t("fieldsets.create")}
        showsHandle
        onClose={() => setIsCreating(false)}
        onSubmit={async (name, handle) => {
          const created = await createFieldset({ name, handle });
          await queryClient.invalidateQueries({ queryKey: fieldsetKeys.fieldsets() });
          setIsCreating(false);
          await navigate({ to: "/build/fieldsets/$handle", params: { handle: created.handle } });
        }}
      />
    </Page>
  );
}
