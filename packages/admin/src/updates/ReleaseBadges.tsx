import { Badge } from "../design/Badge.js";
import { t } from "../i18n/strings.js";
import type { AvailableRelease } from "./updates.api.js";

export function ReleaseBadges({ release }: { release: AvailableRelease }) {
  if (!release.security && !release.breaking && release.channel !== "beta") return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {release.security && <Badge tone="danger">{t("updates.security")}</Badge>}
      {release.breaking && <Badge tone="warning">{t("updates.breaking")}</Badge>}
      {release.channel === "beta" && <Badge tone="accent">{t("updates.beta")}</Badge>}
    </span>
  );
}

/** One sentence for each badge, so the colour is never the only way to know. */
export function ReleaseWarnings({ release }: { release: AvailableRelease }) {
  const lines = [
    release.security && t("updates.securityExplained"),
    release.breaking && t("updates.breakingExplained"),
    release.channel === "beta" && t("updates.betaExplained"),
  ].filter((line): line is string => typeof line === "string");
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-footnote text-label-secondary">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
