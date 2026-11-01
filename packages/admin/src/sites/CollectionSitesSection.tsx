import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import type { Collection } from "../content/content.types.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { SiteChecklist } from "./SiteChecklist.js";
import { saveCollectionSites } from "./sites.api.js";
import { useAllCollections } from "./sites.queries.js";
import type { CollectionSiteScope, Site } from "./sites.types.js";

/**
 * "Content on each site": for every collection, whether each site has its own entries
 * (and which sites have it at all), or every site shows the same ones. Saved as you choose.
 */
export function CollectionSitesSection({ sites }: { sites: readonly Site[] }) {
  const collections = useAllCollections();

  return (
    <section aria-labelledby="collection-sites-heading" className="flex flex-col gap-2">
      <div className="px-1">
        <h2 id="collection-sites-heading" className="text-headline text-label">
          {t("sites.collections.title")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("sites.collections.description")}</p>
      </div>
      {collections.isError && (
        <LoadError error={collections.error} onRetry={() => void collections.refetch()} />
      )}
      <div className="flex flex-col divide-y divide-separator rounded-card bg-surface">
        {collections.data?.map((collection) => (
          <CollectionRow key={collection.handle} collection={collection} sites={sites} />
        ))}
      </div>
    </section>
  );
}

function CollectionRow({ collection, sites }: { collection: Collection; sites: readonly Site[] }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const scope = collection.siteScope ?? "per-site";
  const chosen =
    collection.siteIds == null
      ? null
      : sites.filter((site) => collection.siteIds?.includes(site.id)).map((site) => site.handle);

  async function save(changes: { siteScope: CollectionSiteScope; siteHandles: string[] | null }) {
    setIsSaving(true);
    setError(undefined);
    try {
      await saveCollectionSites(collection.handle, changes);
      // The current site's own list of collections may have changed too.
      await queryClient.invalidateQueries();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body font-medium text-label">{collection.name}</p>
        <SegmentedControl
          label={t("sites.collections.scopeLabel", { name: collection.name })}
          value={scope}
          onChange={(next) => void save({ siteScope: next, siteHandles: chosen })}
          options={[
            { value: "per-site", label: t("sites.collections.perSite") },
            { value: "shared", label: t("sites.collections.shared") },
          ]}
        />
      </div>
      {scope === "per-site" ? (
        <SiteChecklist
          legend={t("sites.collections.sitesLegend", { name: collection.name })}
          sites={sites}
          chosen={chosen}
          disabled={isSaving}
          onChange={(siteHandles) => void save({ siteScope: "per-site", siteHandles })}
        />
      ) : (
        <p className="text-footnote text-label-secondary">{t("sites.collections.sharedHint")}</p>
      )}
      {error && (
        <p role="alert" className="text-footnote font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
