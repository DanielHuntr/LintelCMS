import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Tags } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { NameSheet } from "../content/NameSheet.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { useCanChangeContentModel } from "../content-model-sync/contentModelSync.queries.js";
import { ManagedInCodeBanner } from "../content-model-sync/ManagedInCodeBanner.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { SiteOwnershipChoice } from "../sites/SiteOwnershipChoice.js";
import { createTaxonomy } from "./taxonomies.api.js";
import { taxonomyKeys, useTaxonomies } from "./taxonomies.queries.js";
import { Page } from "../design/Page.js";

/** /content/taxonomies: the ways content is grouped, such as Categories and Tags. */
export function TaxonomiesPage() {
  const taxonomies = useTaxonomies();
  const canCreate = useCanChangeContentModel("taxonomies:update");
  const [isCreating, setIsCreating] = useState(false);
  const [siteHandle, setSiteHandle] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function create(name: string, handle: string) {
    const taxonomy = await createTaxonomy({ name, handle, siteHandle });
    await queryClient.invalidateQueries({ queryKey: taxonomyKeys.taxonomies() });
    setIsCreating(false);
    await navigate({ to: "/content/taxonomies/$taxonomy", params: { taxonomy: taxonomy.handle } });
  }

  const newButton = (variant: "filled" | "tinted") =>
    canCreate && (
      <Button
        variant={variant}
        icon={<Plus aria-hidden="true" />}
        onClick={() => setIsCreating(true)}
      >
        {t("taxonomies.new")}
      </Button>
    );

  return (
    <Page width="wide">
      <BackLink to="/content">{t("nav.content")}</BackLink>
      <LargeTitle
        title={t("taxonomies.title")}
        subtitle={t("taxonomies.subtitle")}
        actions={taxonomies.data?.length === 0 ? undefined : newButton("tinted")}
      />
      <ManagedInCodeBanner />

      {taxonomies.isError && (
        <LoadError error={taxonomies.error} onRetry={() => void taxonomies.refetch()} />
      )}
      {taxonomies.isPending && (
        <LoadingRegion label={t("taxonomies.loading")}>
          <div className="flex flex-col gap-px overflow-hidden rounded-card">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-14 rounded-none" />
            ))}
          </div>
        </LoadingRegion>
      )}
      {taxonomies.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Tags}
            title={t("taxonomies.emptyTitle")}
            description={t("taxonomies.emptyDescription")}
            action={newButton("filled")}
          />
        </div>
      )}
      {taxonomies.data && taxonomies.data.length > 0 && (
        <GroupedList footer={t("taxonomies.footer")}>
          {taxonomies.data.map((taxonomy) => (
            <GroupedListRow
              key={taxonomy.id}
              icon={Tags}
              label={taxonomy.name}
              description={t("taxonomies.termCount", { count: taxonomy.termCount })}
              detail={taxonomy.siteId ? t("sites.thisSiteOnly") : undefined}
              to={`/content/taxonomies/${encodeURIComponent(taxonomy.handle)}`}
            />
          ))}
        </GroupedList>
      )}

      <NameSheet
        open={isCreating}
        title={t("taxonomies.newTitle")}
        description={t("taxonomies.newDescription")}
        nameLabel={t("taxonomies.name")}
        submitLabel={t("taxonomies.create")}
        showsHandle
        onSubmit={create}
        onClose={() => setIsCreating(false)}
      >
        <SiteOwnershipChoice
          label={t("sites.taxonomyOwner")}
          ownedBySite={siteHandle !== null}
          onChange={setSiteHandle}
        />
      </NameSheet>
    </Page>
  );
}
