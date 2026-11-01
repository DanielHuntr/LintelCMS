import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { NameSheet } from "../content/NameSheet.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { createGlobalSet } from "./globals.api.js";
import { globalKeys, useGlobalSets } from "./globals.queries.js";

/** /content/globals: site-wide settings, such as the footer text and social links. */
export function GlobalsPage() {
  const globalSets = useGlobalSets();
  const canCreate = useCan("blueprints:update");
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function create(name: string, handle: string) {
    const created = await createGlobalSet({ name, handle });
    await queryClient.invalidateQueries({ queryKey: globalKeys.globalSets() });
    setIsCreating(false);
    // A new set has no fields yet, so the next step is adding some.
    await navigate({ to: "/content/globals/$handle/fields", params: { handle: created.handle } });
  }

  const newButton = (variant: "filled" | "tinted") =>
    canCreate && (
      <Button
        variant={variant}
        icon={<Plus aria-hidden="true" />}
        onClick={() => setIsCreating(true)}
      >
        {t("globals.new")}
      </Button>
    );

  return (
    <>
      <BackLink to="/content">{t("nav.content")}</BackLink>
      <LargeTitle
        title={t("globals.title")}
        subtitle={t("globals.subtitle")}
        actions={globalSets.data?.length === 0 ? undefined : newButton("tinted")}
      />
      {globalSets.isError && (
        <LoadError error={globalSets.error} onRetry={() => void globalSets.refetch()} />
      )}
      {globalSets.isPending && (
        <LoadingRegion label={t("globals.loading")}>
          <Skeleton className="h-14 rounded-card" />
        </LoadingRegion>
      )}
      {globalSets.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={SlidersHorizontal}
            title={t("globals.emptyTitle")}
            description={t("globals.emptyDescription")}
            action={newButton("filled")}
          />
        </div>
      )}
      {globalSets.data && globalSets.data.length > 0 && (
        <GroupedList footer={t("globals.footer")}>
          {globalSets.data.map((globalSet) => (
            <GroupedListRow
              key={globalSet.id}
              icon={SlidersHorizontal}
              label={globalSet.name}
              description={t("builder.fieldCount", { count: globalSet.fieldCount })}
              to={`/content/globals/${encodeURIComponent(globalSet.handle)}`}
            />
          ))}
        </GroupedList>
      )}
      <NameSheet
        open={isCreating}
        title={t("globals.newTitle")}
        description={t("globals.newDescription")}
        nameLabel={t("globals.name")}
        submitLabel={t("globals.create")}
        showsHandle
        onSubmit={create}
        onClose={() => setIsCreating(false)}
      />
    </>
  );
}
