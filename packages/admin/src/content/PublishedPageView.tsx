import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { apiRequest } from "../api/client.js";
import { LoadError } from "../api/LoadError.js";
import { useBlueprint } from "../content-types/blueprints.queries.js";
import { BackLink } from "../design/BackLink.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { fullDocsUrl } from "../help/docsLinks.js";
import { t } from "../i18n/strings.js";
import { BuiltInPreview } from "../preview/BuiltInPreview.js";
import type { DeliveredEntry } from "../preview/preview.types.js";
import { useCollection, useEntry } from "./content.queries.js";

interface PublishedPageViewProps {
  collectionHandle: string;
  entryId: string;
}

/**
 * "View page" when no website is connected yet: the published version, exactly as the
 * delivery API serves it, drawn by Lintel's simple renderer, with a note on connecting a site.
 */
export function PublishedPageView({ collectionHandle, entryId }: PublishedPageViewProps) {
  const collection = useCollection(collectionHandle);
  const entry = useEntry(entryId);
  const blueprint = useBlueprint(collection.data?.blueprintHandle);
  const slug = entry.data?.slug;
  const locale = entry.data?.locale;
  const published = useQuery({
    queryKey: ["published-page", collectionHandle, slug, locale],
    enabled: slug !== undefined,
    queryFn: () =>
      apiRequest<DeliveredEntry>(
        `/delivery/${collectionHandle}/${encodeURIComponent(slug ?? "")}?locale=${encodeURIComponent(locale ?? "")}`,
      ),
  });

  const failed = [collection, entry, blueprint, published].find((query) => query.isError);

  return (
    <Page width="wide" className="flex flex-col gap-6">
      <BackLink
        to="/content/$collection/$entryId"
        params={{ collection: collectionHandle, entryId }}
      >
        {entry.data?.title || t("entries.untitled")}
      </BackLink>
      <div
        role="note"
        className="flex items-start gap-3 rounded-card bg-accent/10 px-4 py-3 text-footnote text-label"
      >
        <Info aria-hidden="true" strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>
          {t("viewPage.notConnected")}{" "}
          <Link
            to="/settings/site"
            className="font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2"
          >
            {t("viewPage.connect")}
          </Link>{" "}
          <a
            href={fullDocsUrl("building/nextjs-starter")}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2"
          >
            {t("viewPage.starterGuide")}
          </a>
        </p>
      </div>
      {failed && <LoadError error={failed.error} onRetry={() => void failed.refetch()} />}
      {!failed && (!published.data || !blueprint.data) && (
        <LoadingRegion label={t("viewPage.loading")}>
          <Skeleton className="h-96 rounded-card" />
        </LoadingRegion>
      )}
      {published.data && blueprint.data && (
        <div className="rounded-card bg-surface">
          <BuiltInPreview entry={published.data} fields={blueprint.data.fields} />
        </div>
      )}
    </Page>
  );
}
