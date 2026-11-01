import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { type Feature, listFeatures, setEnabledFeatures } from "./features.api.js";

const featuresKey = ["plugins"] as const;

/**
 * Settings → Features: every plugin, built in or installed, with a switch. Switching one
 * on or off reloads who is signed in, so the sidebar and every screen follow at once.
 */
export function FeaturesSettingsPage() {
  const features = useQuery({ queryKey: featuresKey, queryFn: listFeatures });
  const canChange = useCan("settings:update");
  const queryClient = useQueryClient();
  const router = useRouter();
  const [status, setStatus] = useState("");

  const change = useMutation({
    mutationFn: setEnabledFeatures,
    onSuccess: async (updated) => {
      queryClient.setQueryData(featuresKey, updated);
      // The session carries enabledPlugins, so the router fetches it again.
      await router.invalidate();
    },
  });

  function toggle(feature: Feature, isOn: boolean) {
    const current = (features.data ?? []).filter((each) => each.enabled).map((each) => each.id);
    const enabled = isOn ? [...current, feature.id] : current.filter((id) => id !== feature.id);
    change.mutate(enabled, {
      onSuccess: () =>
        setStatus(
          t(isOn ? "featureSettings.switchedOn" : "featureSettings.switchedOff", {
            name: feature.name,
          }),
        ),
    });
  }

  const builtIn = features.data?.filter((feature) => feature.source === "built-in") ?? [];
  const installed = features.data?.filter((feature) => feature.source === "installed") ?? [];

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("featureSettings.title")}
        subtitle={t("featureSettings.subtitle")}
        actions={<Badge tone="accent">{t("featureSettings.beta")}</Badge>}
      />
      <div className="flex max-w-2xl flex-col gap-8">
        {features.isError && (
          <LoadError error={features.error} onRetry={() => void features.refetch()} />
        )}
        {features.isPending && (
          <LoadingRegion label={t("featureSettings.loading")}>
            <Skeleton className="h-48 w-full rounded-card" />
          </LoadingRegion>
        )}
        {!canChange && features.data && (
          <p className="text-footnote text-label-secondary">{t("featureSettings.readOnly")}</p>
        )}
        {builtIn.length > 0 && (
          <FeatureGroup
            header={t("featureSettings.builtInHeader")}
            features={builtIn}
            canChange={canChange && !change.isPending}
            onToggle={toggle}
          />
        )}
        {installed.length > 0 && (
          <FeatureGroup
            header={t("featureSettings.installedHeader")}
            footer={t("featureSettings.installedFooter")}
            features={installed}
            canChange={canChange && !change.isPending}
            onToggle={toggle}
          />
        )}
        {change.isError && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(change.error)}
          </p>
        )}
        <p role="status" className="text-footnote text-label-secondary">
          {status}
        </p>
      </div>
    </>
  );
}

interface FeatureGroupProps {
  header: string;
  footer?: string;
  features: readonly Feature[];
  canChange: boolean;
  onToggle: (feature: Feature, isOn: boolean) => void;
}

function FeatureGroup({ header, footer, features, canChange, onToggle }: FeatureGroupProps) {
  return (
    <GroupedList header={header} footer={footer}>
      {features.map((feature) => (
        <GroupedListRow
          key={feature.id}
          label={feature.name}
          description={feature.description}
          detail={
            feature.version ? t("featureSettings.version", { version: feature.version }) : undefined
          }
          wrapsText
          accessory={
            <Toggle
              label={feature.name}
              labelVisibility="hidden"
              checked={feature.enabled}
              disabled={!canChange}
              onCheckedChange={(isOn) => onToggle(feature, isOn)}
            />
          }
        />
      ))}
    </GroupedList>
  );
}
