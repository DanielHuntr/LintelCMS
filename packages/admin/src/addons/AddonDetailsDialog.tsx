import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { Toggle } from "../design/Toggle.js";
import { enabledAfterToggle } from "../features/featureContent.js";
import { listFeatures, saveEnabledFeatures } from "../features/features.api.js";
import { type StringKey, t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddonSettingsForm } from "./AddonSettingsForm.js";
import { type Addon, addonKeys } from "./addons.api.js";
import { failedAddonAdminHalves } from "./loadAddonAdminHalves.js";
import { readSettingsForm } from "./settingsForm.js";

interface AddonDetailsDialogProps {
  addon: Addon;
  onClose: () => void;
}

/**
 * One add-on: its switch first, then what it adds and can reach, its settings, and how it
 * is removed. Switching saves straight away and reloads who is signed in, so its sidebar
 * items and widgets appear or go at once.
 */
export function AddonDetailsDialog({ addon, onClose }: AddonDetailsDialogProps) {
  const canChange = useCan("settings:update");
  const queryClient = useQueryClient();
  const router = useRouter();
  const addonId = addon.id;

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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Toggle
            label={t("addons.switch", { name: addon.name })}
            checked={addon.enabled}
            disabled={!canChange || !addonId || toggle.isPending}
            onCheckedChange={(isOn) => toggle.mutate(isOn)}
          />
          <p role="status" className="min-h-5 text-footnote text-label-secondary">
            {toggle.isPending && t("addons.saving")}
            {toggle.isError && <span className="text-danger">{describeError(toggle.error)}</span>}
          </p>
          <p className="text-footnote text-label-secondary">{whereFrom(addon)}</p>
          {addonId && failedAddonAdminHalves.has(addonId) && (
            <p className="text-footnote text-warning">{t("addons.adminFailed")}</p>
          )}
        </div>

        {addon.adds.length > 0 && (
          <Section title={t("addons.adds")}>
            <ul className="list-disc ps-5 text-body text-label">
              {addon.adds.map((part) => (
                <li key={part}>{t(`addons.part.${part}` as StringKey)}</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t("addons.access")}>
          <p className="text-body text-label">{t("addons.accessText")}</p>
          {addon.permissions.length > 0 && (
            <>
              <p className="text-footnote text-label-secondary">{t("addons.permissions")}</p>
              <ul className="list-disc ps-5 text-footnote text-label-secondary">
                {addon.permissions.map(({ permission, description }) => (
                  <li key={permission}>{description}</li>
                ))}
              </ul>
            </>
          )}
        </Section>

        {hasSettings && addonId && (
          <Section title={t("addons.settings")}>
            {formFields ? (
              <AddonSettingsForm addonId={addonId} fields={formFields} canChange={canChange} />
            ) : (
              <p className="text-body text-label-secondary">{t("addons.settingsOwnScreen")}</p>
            )}
          </Section>
        )}

        {addon.from === "npm" && addon.packageName && (
          <Section title={t("addons.remove")}>
            <p className="text-body text-label-secondary">{t("addons.removeText")}</p>
            <p className="text-footnote text-label-secondary">{t("addons.removeCommand")}</p>
            <code className="block rounded-control bg-fill px-3 py-2 font-mono text-footnote text-label select-all">
              pnpm lintel addons remove {addon.packageName}
            </code>
          </Section>
        )}
      </div>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-headline text-label">{title}</h3>
      {children}
    </section>
  );
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
