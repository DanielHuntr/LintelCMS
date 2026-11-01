import { ArrowUpRight, History } from "lucide-react";
import { formatDateTime } from "../content/relativeTime.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { CommandList } from "./CommandList.js";
import type { InstalledVersion, PluginUpdate, ReleaseChannel } from "./updates.api.js";

/** Newer versions of the npm plugins lintel.config.ts lists, and how to install them. */
export function PluginUpdatesCard({ plugins }: { plugins: PluginUpdate[] }) {
  if (plugins.length === 0) return null;
  return (
    <Card title={t("updates.pluginsTitle")}>
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1.5">
          {plugins.map((plugin) => (
            <li
              key={plugin.packageName}
              className="flex flex-wrap items-center gap-2 text-body text-label"
            >
              {t("updates.pluginUpdate", {
                name: plugin.packageName,
                from: plugin.installedVersion,
                to: plugin.latestVersion,
              })}
              <a
                href={plugin.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-footnote text-accent underline"
              >
                {t("updates.pluginPage", { name: plugin.packageName })}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                <span className="sr-only">{t("help.newTab")}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-footnote text-label-secondary">{t("updates.pluginHelp")}</p>
        <CommandList
          commands={[
            `pnpm add -w ${plugins.map((plugin) => `${plugin.packageName}@${plugin.latestVersion}`).join(" ")}`,
          ]}
          version=""
        />
      </div>
    </Card>
  );
}

export function ChannelCard({
  channel,
  canChange,
  onChange,
}: {
  channel: ReleaseChannel;
  canChange: boolean;
  onChange: (channel: ReleaseChannel) => void;
}) {
  return (
    <Card title={t("updates.channelTitle")}>
      <div className="flex flex-col items-start gap-3">
        {canChange ? (
          <SegmentedControl
            label={t("updates.channelLabel")}
            options={[
              { value: "stable", label: t("updates.channel.stable") },
              { value: "beta", label: t("updates.channel.beta") },
            ]}
            value={channel}
            onChange={onChange}
          />
        ) : (
          <p className="text-body text-label">{t(`updates.channel.${channel}`)}</p>
        )}
        <p className="text-footnote text-label-secondary">{t("updates.channelHelp")}</p>
      </div>
    </Card>
  );
}

/** Versions kept on this server, newest first, each but the running one with Roll back. */
export function EarlierVersionsCard({
  versions,
  canRollBack,
  onRollBack,
}: {
  versions: InstalledVersion[];
  canRollBack: boolean;
  onRollBack: (version: InstalledVersion) => void;
}) {
  if (versions.length < 2) return null;
  return (
    <Card title={t("updates.earlierTitle")}>
      <p className="mb-3 text-footnote text-label-secondary">{t("updates.earlierHelp")}</p>
      <ul className="flex flex-col">
        {versions.map((version) => (
          <li
            key={version.version}
            className="hairline-top flex items-center gap-3 py-2.5 first:shadow-none"
          >
            <History
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4 text-label-secondary"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-label">
                {t("about.footer", { version: version.version })}
              </span>
              {version.installedAt && (
                <span className="text-footnote text-label-secondary">
                  {formatDateTime(version.installedAt)}
                </span>
              )}
            </span>
            {version.current ? (
              <Badge tone="success">{t("updates.runningNow")}</Badge>
            ) : (
              canRollBack && (
                <Button
                  variant="tinted"
                  size="small"
                  aria-label={t("updates.rollBackTo", { version: version.version })}
                  onClick={() => onRollBack(version)}
                >
                  {t("updates.rollBack")}
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
