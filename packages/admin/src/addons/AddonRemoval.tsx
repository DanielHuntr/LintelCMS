import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eraser, Archive } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { ChoiceCardGroup } from "../design/ChoiceCardGroup.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { t } from "../i18n/strings.js";
import { Fold } from "./AddonAbout.js";
import {
  type Addon,
  type AddonDetails,
  addonExportUrl,
  addonKeys,
  deleteAddonData,
} from "./addons.api.js";

type DataChoice = "keep" | "delete";

/**
 * Removing an add-on: export first if you want a copy, then keep its data or delete it. The
 * uninstalling itself is a command, for whoever looks after the site.
 */
export function AddonRemoval({
  addon,
  details,
  canChange,
}: {
  addon: Addon;
  details: AddonDetails | undefined;
  canChange: boolean;
}) {
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<DataChoice>("keep");
  const [confirming, setConfirming] = useState(false);
  const addonId = addon.id ?? "";
  const tables = [
    ...(details?.stores.tables.filter((table) => table.checked) ?? []),
    ...(details?.stores.undeclared ?? []),
  ].map((table) => table.name);
  const hasData = tables.length > 0 || details?.stores.settings === true;

  const deletion = useMutation({
    mutationFn: () => deleteAddonData(addonId),
    onSuccess: async () => {
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: addonKeys.all() });
    },
  });

  const exportLink = "text-footnote text-accent";
  return (
    <Fold title={t("addons.remove")}>
      {canChange && addon.id && hasData && (
        <>
          <ChoiceCardGroup
            label={t("addons.remove")}
            value={choice}
            onChange={setChoice}
            options={[
              {
                value: "keep",
                title: t("addons.removal.keep"),
                description: t("addons.removal.keepHint"),
                icon: Archive,
              },
              {
                value: "delete",
                title: t("addons.removal.delete"),
                description: t("addons.removal.deleteHint"),
                icon: Eraser,
              },
            ]}
          />
          {tables.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="text-footnote font-semibold text-label-secondary">
                {t("addons.removal.export")}
              </h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <a className={exportLink} href={addonExportUrl(addonId)} download>
                  {t("addons.removal.exportJson")}
                </a>
                {tables.map((table) => (
                  <a
                    key={table}
                    className={exportLink}
                    href={addonExportUrl(addonId, table)}
                    download
                  >
                    {t("addons.removal.exportCsv", { table })}
                  </a>
                ))}
              </div>
            </div>
          )}
          <p className="text-footnote text-label-secondary">{t("addons.removal.backups")}</p>
          {choice === "delete" && (
            <div className="flex flex-col items-start gap-1">
              <Button
                variant="plain"
                disabled={addon.enabled || deletion.isPending}
                onClick={() => setConfirming(true)}
              >
                {t("addons.removal.deleteNow")}
              </Button>
              {addon.enabled && (
                <p className="text-footnote text-label-secondary">
                  {t("addons.removal.switchOffFirst")}
                </p>
              )}
            </div>
          )}
          <p role="status" className="text-footnote text-label-secondary">
            {deletion.isSuccess && t("addons.removal.deleted")}
            {deletion.isError && (
              <span className="text-danger">{describeError(deletion.error)}</span>
            )}
          </p>
          <ConfirmDialog
            open={confirming}
            title={t("addons.removal.confirmTitle", { name: addon.name })}
            message={t("addons.removal.confirmText")}
            confirmLabel={t("addons.removal.deleteNow")}
            cancelLabel={t("addons.removal.cancel")}
            isDestructive
            isWorking={deletion.isPending}
            onConfirm={() => deletion.mutate()}
            onCancel={() => setConfirming(false)}
          />
        </>
      )}
      {addon.from === "npm" && addon.packageName && (
        <>
          <p className="text-footnote text-label-secondary">{t("addons.removeCommand")}</p>
          <code className="block rounded-control bg-fill px-3 py-2 font-mono text-footnote text-label select-all">
            pnpm lintel addons remove {addon.packageName}
          </code>
        </>
      )}
    </Fold>
  );
}
