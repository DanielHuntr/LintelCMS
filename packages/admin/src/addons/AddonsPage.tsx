import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Puzzle } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { AddonDetailsDialog } from "./AddonDetailsDialog.js";
import { type Addon, addonKeys, listAddons } from "./addons.api.js";

/**
 * /build/addons: the add-ons installed into this site. Each row says whether it is on;
 * choosing one opens its details, where it is switched on and off, its settings are
 * changed and what it can reach is spelt out. Add-ons that can't run are listed apart,
 * with why.
 */
export function AddonsPage() {
  const addons = useQuery({ queryKey: addonKeys.all(), queryFn: listAddons });
  const [openKey, setOpenKey] = useState<string>();

  const list = addons.data?.addons ?? [];
  const working = list.filter((addon) => addon.problem === null);
  const broken = list.filter((addon) => addon.problem !== null);
  const open = list.find((addon) => keyOf(addon) === openKey);

  return (
    <Page width="readable">
      <BackLink to="/build">{t("nav.build")}</BackLink>
      <LargeTitle title={t("addons.title")} subtitle={t("addons.subtitle")} />

      {addons.isError && <LoadError error={addons.error} onRetry={() => void addons.refetch()} />}

      {addons.isPending && (
        <LoadingRegion label={t("addons.loading")}>
          <div className="flex flex-col gap-px overflow-hidden rounded-card">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-16 rounded-none" />
            ))}
          </div>
        </LoadingRegion>
      )}

      {addons.data && list.length === 0 && (
        <EmptyState
          icon={Puzzle}
          title={t("addons.empty.title")}
          description={t("addons.empty.description")}
          size="page"
        />
      )}

      {addons.data && list.length > 0 && (
        <div className="flex flex-col gap-8">
          {working.length > 0 && (
            <GroupedList header={t("addons.header")} footer={t("addons.footer")}>
              {working.map((addon) => (
                <GroupedListRow
                  key={keyOf(addon)}
                  icon={Puzzle}
                  label={addon.name}
                  description={addon.description}
                  wrapsText
                  detail={addon.enabled ? t("addons.on") : t("addons.off")}
                  onSelect={() => setOpenKey(keyOf(addon))}
                />
              ))}
            </GroupedList>
          )}
          {broken.length > 0 && (
            <GroupedList header={t("addons.problemsHeader")}>
              {broken.map((addon) => (
                <GroupedListRow
                  key={keyOf(addon)}
                  icon={CircleAlert}
                  iconTone="warning"
                  label={addon.name}
                  description={addon.problem ?? undefined}
                  wrapsText
                  detail={t("addons.problem")}
                />
              ))}
            </GroupedList>
          )}
        </div>
      )}

      {open && <AddonDetailsDialog addon={open} onClose={() => setOpenKey(undefined)} />}
    </Page>
  );
}

function keyOf(addon: Addon): string {
  return addon.id ?? addon.name;
}
