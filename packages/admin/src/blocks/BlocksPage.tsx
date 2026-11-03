import { Component } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import type { SiteBlock } from "./blocks.api.js";
import { useBlocks } from "./blocks.queries.js";

/**
 * Design → Your site's blocks: every block the site has, grouped as Insert groups them, with
 * who looks after it and how many pages use it. A new site is told how to make its first one
 * (from the builder, with Make into a block), since that is where blocks begin.
 */
export function BlocksPage() {
  const blocks = useBlocks();
  const groups = groupByCategory(blocks.data ?? []);

  return (
    <Page width="wide">
      <BackLink to="/design">{t("nav.design")}</BackLink>
      <LargeTitle title={t("blocks.title")} subtitle={t("blocks.subtitle")} />

      {blocks.isError && <LoadError error={blocks.error} onRetry={() => void blocks.refetch()} />}
      {blocks.isPending && (
        <LoadingRegion label={t("blocks.loading")}>
          <Skeleton className="h-28 rounded-card" />
        </LoadingRegion>
      )}
      {blocks.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Component}
            title={t("blocks.emptyTitle")}
            description={t("blocks.emptyDescription")}
            action={<LinkButton to="/content">{t("nav.content")}</LinkButton>}
          />
        </div>
      )}
      <div className="flex flex-col gap-8">
        {groups.map(([category, members], index) => (
          <GroupedList
            key={category || "ungrouped"}
            header={category || undefined}
            footer={index === groups.length - 1 ? t("blocks.footer") : undefined}
          >
            {members.map((block) => (
              <GroupedListRow
                key={block.handle}
                icon={Component}
                label={block.name}
                description={[
                  t("blocks.propertyCount", { count: block.properties.length }),
                  t("blocks.usedOn", { count: block.usedOn.length }),
                ].join(" · ")}
                accessory={
                  <Badge tone={block.source === "site" ? "accent" : "neutral"}>
                    {t(`blocks.source.${block.source}`)}
                  </Badge>
                }
                to={`/design/blocks/${encodeURIComponent(block.handle)}`}
              />
            ))}
          </GroupedList>
        ))}
      </div>
    </Page>
  );
}

function groupByCategory(blocks: readonly SiteBlock[]): Array<[string, SiteBlock[]]> {
  const groups = new Map<string, SiteBlock[]>();
  for (const block of blocks) {
    groups.set(block.category, [...(groups.get(block.category) ?? []), block]);
  }
  return [...groups.entries()].sort(([first], [second]) =>
    first === "" ? 1 : second === "" ? -1 : first.localeCompare(second),
  );
}
