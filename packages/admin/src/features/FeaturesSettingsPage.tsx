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
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { enabledAfterToggle, keptContentMessageFor } from "./featureContent.js";
import { type Feature, listFeatures, saveEnabledFeatures } from "./features.api.js";

export const featureKeys = { all: () => ["features"] as const };

interface SavedChange {
  /** What was on before, so the change can be undone. */
  previouslyEnabled: string[];
}

/**
 * /build/features: every plugin, built in or installed, with a switch. Each switch saves
 * straight away and reloads who is signed in, so the sidebar and every screen follow at
 * once. Switching off a feature that may hold content asks first, and says it is kept.
 */
export function FeaturesSettingsPage() {
  const features = useQuery({ queryKey: featureKeys.all(), queryFn: listFeatures });
  const canChange = useCan("settings:update");
  const queryClient = useQueryClient();
  const router = useRouter();
  const [lastChange, setLastChange] = useState<SavedChange>();
  const [askingToSwitchOff, setAskingToSwitchOff] = useState<Feature>();

  const save = useMutation({
    mutationFn: (change: { enabled: string[]; previouslyEnabled: string[] }) =>
      saveEnabledFeatures(change.enabled),
    onSuccess: (saved, change) => {
      queryClient.setQueryData(featureKeys.all(), saved);
      setLastChange({ previouslyEnabled: change.previouslyEnabled });
      // The session carries enabledPlugins: fetch it again so the sidebar follows.
      void router.invalidate();
    },
  });

  const list = features.data ?? [];
  const enabledIds = list.filter((feature) => feature.enabled).map((feature) => feature.id);
  const builtIn = list.filter((feature) => feature.source === "built-in");
  const installed = list.filter((feature) => feature.source === "installed");

  function saveEnabled(enabled: string[]) {
    setAskingToSwitchOff(undefined);
    save.mutate({ enabled, previouslyEnabled: enabledIds });
  }

  function toggle(feature: Feature, isOn: boolean) {
    if (!isOn && keptContentMessageFor(feature)) {
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

  const keptContent = askingToSwitchOff && keptContentMessageFor(askingToSwitchOff);
  const switchesDisabled = !canChange || save.isPending;

  return (
    <Page width="readable">
      <BackLink to="/build">{t("nav.build")}</BackLink>
      <LargeTitle title={t("features.title")} subtitle={t("features.subtitle")} />

      {features.isError && (
        <LoadError error={features.error} onRetry={() => void features.refetch()} />
      )}

      {features.isPending && (
        <LoadingRegion label={t("features.loading")}>
          <div className="flex flex-col gap-px overflow-hidden rounded-card">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-16 rounded-none" />
            ))}
          </div>
        </LoadingRegion>
      )}

      {features.data && (
        <div className="flex flex-col gap-8">
          <FeatureGroup
            header={installed.length > 0 ? t("features.builtInHeader") : undefined}
            footer={canChange ? t("features.footer") : t("features.readOnly")}
            features={builtIn}
            disabled={switchesDisabled}
            onToggle={toggle}
          />
          {installed.length > 0 && (
            <FeatureGroup
              header={t("features.installedHeader")}
              footer={t("features.installedFooter")}
              features={installed}
              disabled={switchesDisabled}
              onToggle={toggle}
            />
          )}

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
    </Page>
  );
}

interface FeatureGroupProps {
  header: string | undefined;
  footer: string;
  features: readonly Feature[];
  disabled: boolean;
  onToggle: (feature: Feature, isOn: boolean) => void;
}

function FeatureGroup({ header, footer, features, disabled, onToggle }: FeatureGroupProps) {
  return (
    <GroupedList header={header} footer={footer}>
      {features.map((feature) => (
        <GroupedListRow
          key={feature.id}
          icon={Puzzle}
          label={feature.name}
          description={feature.description}
          detail={feature.version ? t("features.version", { version: feature.version }) : undefined}
          wrapsText
          accessory={
            <Toggle
              label={feature.name}
              labelVisibility="hidden"
              checked={feature.enabled}
              disabled={disabled}
              onCheckedChange={(isOn) => onToggle(feature, isOn)}
            />
          }
        />
      ))}
    </GroupedList>
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
