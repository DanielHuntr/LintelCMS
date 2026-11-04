import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { Toggle } from "../design/Toggle.js";
import { enabledAfterToggle } from "../features/featureContent.js";
import { listFeatures, saveEnabledFeatures } from "../features/features.api.js";
import { t } from "../i18n/strings.js";
import { useVisibleContributions } from "../plugins/AdminPluginsContext.js";
import { useCan } from "../session/SessionContext.js";
import { AddonAbout, Fold } from "./AddonAbout.js";
import { AddonRemoval } from "./AddonRemoval.js";
import { AddonSettingsForm } from "./AddonSettingsForm.js";
import { type Addon, addonKeys, getAddonDetails } from "./addons.api.js";
import { failedAddonAdminHalves } from "./loadAddonAdminHalves.js";
import { readSettingsForm } from "./settingsForm.js";

interface AddonDetailsDialogProps {
  addon: Addon;
  onClose: () => void;
}

/**
 * One add-on: its switch first, then what it keeps and does in folded sections (stored data
 * first), its settings, what it can reach, and how it is removed. Switching saves straight
 * away and reloads who is signed in, so its sidebar items and widgets appear or go at once.
 */
export function AddonDetailsDialog({ addon, onClose }: AddonDetailsDialogProps) {
  const canChange = useCan("settings:update");
  const queryClient = useQueryClient();
  const router = useRouter();
  const addonId = addon.id;
  const ownScreen = useAddonScreen(addonId);

  const toggle = useMutation({
    mutationFn: async (isOn: boolean) => {
      if (!addonId) return;
      const features = await listFeatures();
      const enabled = features.filter((feature) => feature.enabled).map(({ id }) => id);
      await saveEnabledFeatures(
        enabledAfterToggle(
          features.map(({ id }) => id),
          enabled,
          addonId,
          isOn,
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: addonKeys.all() });
      // The session carries enabledPlugins: fetch it again so the sidebar follows.
      void router.invalidate();
    },
  });

  const details = useQuery({
    queryKey: [...addonKeys.all(), addonId, "details"],
    queryFn: () => getAddonDetails(addonId ?? ""),
    enabled: addonId !== null,
    retry: false,
  });

  const formFields = readSettingsForm(addon.settingsSchema);
  const hasSettings = addon.adds.includes("settings");

  return (
    <Dialog
      open
      onClose={onClose}
      title={addon.name}
      description={addon.description}
      footer={
        <Button variant="filled" onClick={onClose}>
          {t("addons.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Toggle
            label={t("addons.switch", { name: addon.name })}
            checked={addon.enabled}
            disabled={!canChange || !addonId || toggle.isPending}
            onCheckedChange={(isOn) => toggle.mutate(isOn)}
          />
          <p role="status" className="text-footnote text-label-secondary">
            {toggle.isPending && t("addons.saving")}
            {toggle.isError && <span className="text-danger">{describeError(toggle.error)}</span>}
          </p>
          <p className="text-footnote text-label-secondary">{whereFrom(addon)}</p>
          {ownScreen && (
            <Link
              to={ownScreen}
              onClick={onClose}
              className="self-start text-footnote font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
            >
              {t("addons.openScreen", { name: addon.name })}
            </Link>
          )}
          {addonId && failedAddonAdminHalves.has(addonId) && (
            <p className="text-footnote text-warning">{t("addons.adminFailed")}</p>
          )}
        </div>

        <p className="text-footnote text-label-secondary">
          {addon.dataOnly
            ? t("addons.accessDataOnly")
            : `${t("addons.accessText")} ${t("addons.untrusted")}`}
        </p>

        <div className="flex flex-col gap-2">
          {details.isPending && addonId && (
            <p role="status" className="text-footnote text-label-secondary">
              {t("addons.loadingDetails")}
            </p>
          )}
          {details.isError && (
            <p className="text-footnote text-danger">
              {t("addons.detailsFailed", { reason: describeError(details.error) })}
            </p>
          )}
          {details.data && <AddonAbout addon={addon} details={details.data} />}

          {hasSettings && addonId && (
            <Fold title={t("addons.settings")}>
              {formFields ? (
                <AddonSettingsForm addonId={addonId} fields={formFields} canChange={canChange} />
              ) : (
                <p className="text-body text-label-secondary">{t("addons.settingsOwnScreen")}</p>
              )}
            </Fold>
          )}

          {addon.permissions.length > 0 && (
            <Fold title={t("addons.access")}>
              <p className="text-footnote text-label-secondary">{t("addons.permissions")}</p>
              <ul className="list-disc ps-5 text-footnote text-label-secondary">
                {addon.permissions.map(({ permission, description }) => (
                  <li key={permission}>{description}</li>
                ))}
              </ul>
            </Fold>
          )}

          <AddonRemoval addon={addon} details={details.data} canChange={canChange} />
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Where the add-on's own screen is, for someone who may open it while it's on: its sidebar
 * link, else its row in Settings, else a screen at a plain address.
 */
function useAddonScreen(addonId: string | null | undefined): string | undefined {
  const own = <Item extends { pluginId: string }>(item: Item) => item.pluginId === addonId;
  const sidebarItem = useVisibleContributions("sidebarItems").find(own);
  const settingsRow = useVisibleContributions("settingsRows").find(own);
  const screen = useVisibleContributions("screens")
    .filter(own)
    .find(({ path }) => !path.includes("$"));
  return sidebarItem?.path ?? settingsRow?.to ?? screen?.path;
}

function whereFrom(addon: Addon): string {
  const version = addon.version ? t("addons.version", { version: addon.version }) : "";
  const source =
    addon.from === "folder"
      ? t("addons.from.folder")
      : addon.from === "config"
        ? t("addons.from.config")
        : (addon.packageName ?? "");
  return [version, source].filter(Boolean).join(" · ");
}
