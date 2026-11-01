import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Check, Puzzle } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { Plugin } from "../setup/setup.api.js";
import { listFeatures, saveEnabledFeatures } from "./features.api.js";
import { enabledAfterToggle, keptContentMessageFor } from "./featureContent.js";

export const featureKeys = { all: () => ["features"] as const };

interface SavedChange {
  /** What was on before, so the change can be undone. */
  previouslyEnabled: string[];
}

/**
 * /settings/features: every feature with a switch. Each switch saves straight away. Switching
 * off a feature that holds content asks first, and says the content is kept.
 */
export function FeaturesSettingsPage() {
  const features = useQuery({ queryKey: featureKeys.all(), queryFn: listFeatures });
  const canChange = useCan("settings:update");
  const queryClient = useQueryClient();
  const router = useRouter();
  const [lastChange, setLastChange] = useState<SavedChange>();
  const [askingToSwitchOff, setAskingToSwitchOff] = useState<Plugin>();

  const save = useMutation({
    mutationFn: (change: { enabled: string[]; previouslyEnabled: string[] }) =>
      saveEnabledFeatures(change.enabled),
    onSuccess: (saved, change) => {
      queryClient.setQueryData(featureKeys.all(), saved);
      setLastChange({ previouslyEnabled: change.previouslyEnabled });
      // The sidebar shows sections by feature: fetch the session again so it follows.
      void router.invalidate();
    },
  });

  const list = features.data ?? [];
  const enabledIds = list.filter((feature) => feature.enabled).map((feature) => feature.id);

  function saveEnabled(enabled: string[]) {
    setAskingToSwitchOff(undefined);
    save.mutate({ enabled, previouslyEnabled: enabledIds });
  }

  function toggle(feature: Plugin, isOn: boolean) {
    if (!isOn && keptContentMessageFor(feature.id)) {
      setAskingToSwitchOff(feature);
      return;
    }
    saveEnabled(
      enabledAfterToggle(
        list.map(({ id }) => id),
        enabledIds,
        feature.id,
        isOn,
      ),
    );
  }

  const keptContent = askingToSwitchOff && keptContentMessageFor(askingToSwitchOff.id);

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("features.title")} subtitle={t("features.subtitle")} />

      {features.isError && (
        <LoadError error={features.error} onRetry={() => void features.refetch()} />
      )}

      {features.isPending && (
        <LoadingRegion label={t("features.loading")}>
          <div className="flex max-w-2xl flex-col gap-px overflow-hidden rounded-card">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-16 rounded-none" />
            ))}
          </div>
        </LoadingRegion>
      )}

      {features.data && (
        <div className="flex max-w-2xl flex-col gap-3">
          <GroupedList footer={canChange ? t("features.footer") : t("features.readOnly")}>
            {list.map((feature) => (
              <GroupedListRow
                key={feature.id}
                icon={Puzzle}
                label={feature.name}
                description={feature.description}
                wrapsText
                accessory={
                  <Toggle
                    label={feature.name}
                    labelVisibility="hidden"
                    checked={feature.enabled}
                    disabled={!canChange || save.isPending}
                    onCheckedChange={(isOn) => toggle(feature, isOn)}
                  />
                }
              />
            ))}
          </GroupedList>

          <SaveStatus
            state={
              save.isPending ? "saving" : save.isError ? "failed" : lastChange ? "saved" : "idle"
            }
            errorMessage={save.isError ? describeError(save.error) : undefined}
            onUndo={
              lastChange && !save.isPending
                ? () => saveEnabled(lastChange.previouslyEnabled)
                : undefined
            }
          />
        </div>
      )}

      <ConfirmDialog
        open={askingToSwitchOff !== undefined}
        title={t("features.switchOffTitle", { name: askingToSwitchOff?.name ?? "" })}
        message={keptContent ? t(keptContent) : ""}
        confirmLabel={t("features.switchOff")}
        cancelLabel={t("features.keepOn")}
        onCancel={() => setAskingToSwitchOff(undefined)}
        onConfirm={() =>
          askingToSwitchOff && saveEnabled(enabledIds.filter((id) => id !== askingToSwitchOff.id))
        }
      />
    </>
  );
}

interface SaveStatusProps {
  state: "idle" | "saving" | "saved" | "failed";
  errorMessage: string | undefined;
  onUndo: (() => void) | undefined;
}

/** "Saving…", then "Saved" with Undo, or what went wrong. Always rendered, so it's announced. */
function SaveStatus({ state, errorMessage, onUndo }: SaveStatusProps) {
  return (
    <div className="flex min-h-7 items-center gap-3 px-4">
      <p role="status" className="flex items-center gap-1 text-footnote text-label-secondary">
        {state === "saving" && t("features.saving")}
        {state === "saved" && (
          <>
            <Check aria-hidden="true" strokeWidth={2.5} className="size-3.5 text-success" />
            {t("features.saved")}
          </>
        )}
        {state === "failed" && <span className="text-danger">{errorMessage}</span>}
      </p>
      {state === "saved" && onUndo && (
        <Button variant="plain" size="small" onClick={onUndo}>
          {t("features.undo")}
        </Button>
      )}
    </div>
  );
}
