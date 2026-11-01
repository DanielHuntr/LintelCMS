import { ArrowUpRight, Download } from "lucide-react";
import { formatDateTime } from "../content/relativeTime.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { ReleaseBadges, ReleaseWarnings } from "./ReleaseBadges.js";
import { ReleaseNotes } from "./ReleaseNotes.js";
import type { AvailableRelease } from "./updates.api.js";

interface AvailableUpdateProps {
  release: AvailableRelease;
  currentVersion: string;
  /** Show the big button: an owner, on an install where it works. */
  canUpdate: boolean;
  /** Why there is no button, when there isn't one. */
  noButtonReason: string | null;
  isStarting: boolean;
  onUpdate: () => void;
}

/** The version the Update button installs: what it is, what changes, and the button. */
export function AvailableUpdate({
  release,
  currentVersion,
  canUpdate,
  noButtonReason,
  isStarting,
  onUpdate,
}: AvailableUpdateProps) {
  return (
    <section
      aria-labelledby="available-update-title"
      className="flex flex-col gap-4 rounded-card bg-surface p-6"
    >
      <header className="flex flex-col gap-2">
        <ReleaseBadges release={release} />
        <h2 id="available-update-title" className="text-title text-label">
          {t("updates.availableTitle", { version: release.version })}
        </h2>
        {release.publishedAt && (
          <p className="text-footnote text-label-secondary">
            {t("updates.published", { when: formatDateTime(release.publishedAt) })}
          </p>
        )}
      </header>
      {release.summary && <p className="text-body text-label">{release.summary}</p>}
      <ReleaseWarnings release={release} />

      <details className="group rounded-control bg-fill/50 px-4 py-3">
        <summary className="cursor-pointer text-body font-medium text-label focus-visible:focus-ring">
          {t("updates.whatChanges")}
        </summary>
        <ReleaseNotes html={release.notesHtml} />
        {release.pageUrl && (
          <a
            href={release.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-footnote text-accent underline"
          >
            {t("updates.fullNotes")}
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{t("help.newTab")}</span>
          </a>
        )}
      </details>

      {canUpdate ? (
        <div className="flex flex-col items-start gap-2">
          <Button
            size="extra-large"
            icon={<Download aria-hidden="true" />}
            onClick={onUpdate}
            disabled={isStarting}
          >
            {t("updates.updateTo", { version: release.version })}
          </Button>
          <p className="text-footnote text-label-secondary">
            {t("updates.backupNote", { version: currentVersion })}
          </p>
        </div>
      ) : (
        noButtonReason && <p className="text-footnote text-label-secondary">{noButtonReason}</p>
      )}
    </section>
  );
}

/** Every other version on offer, each with its notes folded away. */
export function OtherVersions({ releases }: { releases: AvailableRelease[] }) {
  if (releases.length === 0) return null;
  return (
    <section aria-labelledby="other-versions-title" className="flex flex-col gap-3">
      <h2 id="other-versions-title" className="text-headline text-label">
        {t("updates.otherVersions")}
      </h2>
      <ul className="flex flex-col gap-2">
        {releases.map((release) => (
          <li key={release.version} className="rounded-card bg-surface px-5 py-3">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-body text-label focus-visible:focus-ring">
                <span className="font-medium">
                  {t("updates.showNotes", { version: release.version })}
                </span>
                <ReleaseBadges release={release} />
                {release.minimumVersion && (
                  <span className="text-footnote text-label-secondary">
                    {t("updates.needsFirst", { version: release.minimumVersion })}
                  </span>
                )}
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <ReleaseWarnings release={release} />
                <ReleaseNotes html={release.notesHtml} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
