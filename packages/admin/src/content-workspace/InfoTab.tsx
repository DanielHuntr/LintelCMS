import { Link } from "@tanstack/react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LoadError } from "../api/LoadError.js";
import type { Collection, Entry } from "../content/content.types.js";
import { formatDateTime } from "../content/relativeTime.js";
import { CopyButton } from "../design/CopyButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import type { EntryInfo } from "../content-tree/contentTree.types.js";
import { StatusDot } from "../content-tree/StatusDot.js";
import { nodeState } from "../content-tree/treeActions.js";
import { iconForContent } from "../content-tree/typeIcons.js";
import { t } from "../i18n/strings.js";

interface InfoTabProps {
  entry: Entry;
  collection: Collection;
  info: UseQueryResult<EntryInfo>;
}

function describeSiteStart(siteStart: NonNullable<EntryInfo["siteStart"]>): string {
  if (siteStart.isDefault) return t("info.siteStartHome");
  return siteStart.isAssigned ? t("info.siteStartOwn") : t("info.siteStartSlug");
}

/**
 * The Info tab: the entry's address, content type and layout, who made and last changed it,
 * when it was published, what links to it, and its id for developers.
 */
export function InfoTab({ entry, collection, info }: InfoTabProps) {
  if (info.isError) return <LoadError error={info.error} onRetry={() => void info.refetch()} />;
  if (!info.data) {
    return (
      <LoadingRegion label={t("info.loading")}>
        <Skeleton className="h-48 w-full max-w-xl rounded-card" />
      </LoadingRegion>
    );
  }
  const details = info.data;
  const when = (time: string, person: { name: string } | null) =>
    person
      ? t("info.byPerson", { time: formatDateTime(time), person: person.name })
      : formatDateTime(time);

  return (
    <div className="grid max-w-4xl items-start gap-5 @min-[60rem]:grid-cols-[1fr_1fr]">
      <dl className="overflow-hidden rounded-card bg-surface">
        <Detail label={details.urls.length > 1 ? t("info.addresses") : t("info.address")}>
          {details.urls.length === 0 ? (
            <span className="text-label-secondary">{t("info.noAddress")}</span>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {details.urls.map((url) => (
                <li key={url} className="break-all">
                  {url}
                </li>
              ))}
            </ul>
          )}
        </Detail>
        {details.siteStart && (
          <Detail label={t("info.siteStart")}>{describeSiteStart(details.siteStart)}</Detail>
        )}
        <Detail label={t("info.contentType")}>{collection.name}</Detail>
        {collection.routePattern && (
          <Detail label={t("info.layout")}>
            {collection.routePattern.includes("{path}")
              ? t("info.layoutFollowsTree")
              : t("info.layoutValue", { pattern: collection.routePattern })}
          </Detail>
        )}
        <Detail label={t("info.created")}>{when(details.createdAt, details.createdBy)}</Detail>
        <Detail label={t("info.updated")}>{when(details.updatedAt, details.updatedBy)}</Detail>
        <Detail label={t("info.published")}>
          {details.publishedAt ? formatDateTime(details.publishedAt) : t("info.notPublished")}
        </Detail>
        {details.scheduledFor && (
          <Detail label={t("info.scheduled")}>{formatDateTime(details.scheduledFor)}</Detail>
        )}
        <Detail label={t("info.id")}>
          <span className="flex items-center gap-2">
            <code className="truncate font-mono text-footnote">{entry.id}</code>
            <CopyButton value={entry.id} label={t("info.copyId")} variant="plain" />
          </span>
        </Detail>
      </dl>

      <section aria-labelledby="info-used-by" className="overflow-hidden rounded-card bg-surface">
        <div className="px-4 pt-3.5 pb-2">
          <h2 id="info-used-by" className="text-headline text-label">
            {t("info.usedBy")}
          </h2>
          <p className="text-footnote text-label-secondary">{t("info.usedByDescription")}</p>
        </div>
        {details.usedBy.length === 0 ? (
          <p className="px-4 pb-4 text-footnote text-label-secondary">{t("info.usedByNothing")}</p>
        ) : (
          <ul>
            {details.usedBy.map((node) => {
              const Icon = iconForContent(node.collection);
              return (
                <li key={node.id} className="hairline-top">
                  <Link
                    to="/content/$collection/$entryId"
                    params={{ collection: node.collection.handle, entryId: node.id }}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-body text-label hover:bg-fill focus-visible:focus-ring"
                  >
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4 text-label-secondary"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {node.title || t("tree.untitled")}
                    </span>
                    <span className="text-caption text-label-tertiary">{node.collection.name}</span>
                    <StatusDot state={nodeState(node)} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-2.5 hairline-top first:border-t-0">
      <dt className="w-32 shrink-0 text-footnote text-label-secondary">{label}</dt>
      <dd className="min-w-0 flex-1 text-body text-label">{children}</dd>
    </div>
  );
}
