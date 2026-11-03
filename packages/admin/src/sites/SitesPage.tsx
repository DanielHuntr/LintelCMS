import { useQueryClient } from "@tanstack/react-query";
import { Globe, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Badge } from "../design/Badge.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { CollectionSitesSection } from "./CollectionSitesSection.js";
import { RoleSitesSection } from "./RoleSitesSection.js";
import { RowIconButton } from "./RowIconButton.js";
import { newSiteFromDraft, siteChangesFromDraft } from "./siteForm.js";
import { SiteSheet } from "./SiteSheet.js";
import { createSite, deleteSite, updateSite } from "./sites.api.js";
import { siteKeys, useSites } from "./sites.queries.js";
import type { Site } from "./sites.types.js";

/** /build/sites: the websites this Lintel serves, where they live, and who works on each. */
export function SitesPage() {
  const sites = useSites();
  const canEdit = useCan("settings:update");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Site | "new" | null>(null);
  const [removing, setRemoving] = useState<Site | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: siteKeys.sites() });
  const hasSeveralSites = (sites.data?.length ?? 0) > 1;

  async function confirmRemove() {
    if (!removing) return;
    setActionError(null);
    try {
      await deleteSite(removing.handle);
      await refresh();
    } catch (error) {
      setActionError(describeError(error));
    }
    setRemoving(null);
  }

  return (
    <>
      <BackLink to="/build">{t("nav.build")}</BackLink>
      <LargeTitle
        title={t("sites.title")}
        subtitle={t("sites.subtitle")}
        actions={
          canEdit && (
            <Button
              variant="tinted"
              icon={<Plus aria-hidden="true" />}
              onClick={() => setEditing("new")}
            >
              {t("sites.add")}
            </Button>
          )
        }
      />
      {actionError && (
        <p
          role="alert"
          className="mb-6 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          {actionError}
        </p>
      )}
      {sites.isError && <LoadError error={sites.error} onRetry={() => void sites.refetch()} />}
      {sites.isPending && (
        <LoadingRegion label={t("sites.loading")}>
          <Skeleton className="h-14 rounded-card" />
        </LoadingRegion>
      )}
      {sites.data && (
        <div className="flex max-w-2xl flex-col gap-8">
          <GroupedList footer={hasSeveralSites ? t("sites.footerMany") : undefined}>
            {sites.data.map((site) => (
              <GroupedListRow
                key={site.handle}
                icon={Globe}
                iconTone={site.isDefault ? "accent" : "neutral"}
                label={site.name}
                description={describeSiteRow(site)}
                accessory={
                  <span className="flex items-center gap-1">
                    {site.isDefault && <Badge tone="accent">{t("sites.main")}</Badge>}
                    {canEdit && (
                      <RowIconButton
                        label={t("sites.edit", { name: site.name })}
                        onClick={() => setEditing(site)}
                      >
                        <Pencil aria-hidden="true" strokeWidth={1.75} className="size-4" />
                      </RowIconButton>
                    )}
                    {canEdit && !site.isDefault && (
                      <RowIconButton
                        label={t("sites.remove", { name: site.name })}
                        tone="danger"
                        onClick={() => setRemoving(site)}
                      >
                        <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
                      </RowIconButton>
                    )}
                  </span>
                }
              />
            ))}
          </GroupedList>

          {!hasSeveralSites && (
            <EmptyState
              icon={Globe}
              title={t("sites.oneSiteTitle")}
              description={t("sites.oneSiteDescription")}
              action={
                canEdit && (
                  <Button icon={<Plus aria-hidden="true" />} onClick={() => setEditing("new")}>
                    {t("sites.add")}
                  </Button>
                )
              }
            />
          )}
          {hasSeveralSites && canEdit && <CollectionSitesSection sites={sites.data} />}
          {hasSeveralSites && canEdit && <RoleSitesSection sites={sites.data} />}
        </div>
      )}

      {editing && (
        <SiteSheet
          site={editing === "new" ? undefined : editing}
          onSave={async (draft) => {
            if (editing === "new") {
              await createSite(newSiteFromDraft(draft));
            } else {
              await updateSite(editing.handle, siteChangesFromDraft(draft));
            }
            await refresh();
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={t("sites.removeTitle", { name: removing?.name ?? "" })}
        message={t("sites.removeMessage")}
        confirmLabel={t("sites.removeConfirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );
}

/** "acme.fr/fr · French (France) · 12 entries" */
function describeSiteRow(site: Site): string {
  const address =
    site.hostnames.length > 0 ? `${site.hostnames[0]}${site.pathPrefix}` : t("sites.noDomain");
  const language =
    site.locales.find((locale) => locale.code === site.defaultLocale)?.name ?? site.defaultLocale;
  const entries = t("entries.count", { count: site.entryCount });
  return `${address} · ${language} · ${entries}`;
}
