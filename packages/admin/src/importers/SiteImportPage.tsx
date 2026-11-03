import { CircleCheck, PauseCircle } from "lucide-react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { ProgressBar } from "../data-tools/WordPressImportPage.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { SiteImportFound, SiteImportSource } from "./siteImport.api.js";
import { SiteImportReportView } from "./SiteImportReportView.js";
import { useSiteImport, useStartSiteImport } from "./siteImport.queries.js";
import { SiteMappingStep } from "./SiteMappingStep.js";

/**
 * /build/import/:source/:id: one import from Webflow, Framer, Statamic or Umbraco, from
 * the preview and mapping, through the dry run and the progress bar, to the report. A
 * paused import can be resumed. It looks and works like the WordPress importer's page.
 */
export function SiteImportPage({
  source,
  importId,
}: {
  source: SiteImportSource;
  importId: string;
}) {
  const current = useSiteImport(importId);
  const start = useStartSiteImport(importId);
  const data = current.data;
  const sourceTitle = t(`siteImport.${source}.title` as StringKey);

  return (
    <>
      <BackLink to={`/build/import/${source}`}>{sourceTitle}</BackLink>
      <LargeTitle
        title={data?.siteTitle || data?.filename || sourceTitle}
        subtitle={data?.siteAddress}
      />
      {current.isError && (
        <LoadError error={current.error} onRetry={() => void current.refetch()} />
      )}
      {current.isPending && (
        <LoadingRegion label={t("siteImport.loading")}>
          <Skeleton className="h-64 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {data && (
        <div className="flex max-w-2xl flex-col gap-6">
          <FoundCard found={data.found} showNotes={data.status !== "complete"} />
          {data.status === "ready" && (
            <SiteMappingStep
              importId={importId}
              isStarting={start.isPending}
              startError={start.isError ? describeError(start.error) : null}
              onStart={() => start.mutate()}
            />
          )}
          {data.status === "running" && (
            <Card title={t("wordpress.progressTitle")}>
              <ProgressBar progress={data.progress} />
              <p className="mt-2 text-footnote text-label-secondary">
                {t("wordpress.progressHint")}
              </p>
            </Card>
          )}
          {data.status === "paused" && (
            <Card>
              <div className="flex items-start gap-3">
                <PauseCircle aria-hidden="true" className="size-6 shrink-0 text-warning" />
                <div className="flex flex-col gap-2">
                  <h2 className="text-headline text-label">{t("wordpress.pausedTitle")}</h2>
                  <p className="text-body text-label-secondary">{t("wordpress.pausedText")}</p>
                  {data.lastError && (
                    <p className="text-footnote text-label-secondary">{data.lastError}</p>
                  )}
                  <ProgressBar progress={data.progress} />
                  <div>
                    <Button onClick={() => start.mutate()} disabled={start.isPending}>
                      {t("wordpress.resume")}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
          {data.status === "complete" && data.report && (
            <Card>
              <h2 className="mb-4 flex items-center gap-2 text-headline text-label">
                <CircleCheck aria-hidden="true" className="size-5 text-success" />
                {t("wordpress.reportTitle")}
              </h2>
              <SiteImportReportView report={data.report} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}

/** "We found 3 pages, 12 blog posts, 40 pictures and 1 menu." */
export function describeFound(found: SiteImportFound): string {
  const parts = [
    ...found.contentTypes.map((type) => `${type.entries} × ${type.name}`),
    ...(found.media > 0 ? [t("siteImport.found.media", { count: found.media })] : []),
    ...found.taxonomies.map((taxonomy) => `${taxonomy.terms} × ${taxonomy.name}`),
    ...(found.menus > 0 ? [t("siteImport.found.menus", { count: found.menus })] : []),
    ...(found.globals > 0 ? [t("siteImport.found.globals", { count: found.globals })] : []),
  ];
  return parts.length > 0 ? parts.join(", ") : t("siteImport.found.nothing");
}

/** What the files hold; once the import is done the report repeats the notes, so they go. */
function FoundCard({ found, showNotes }: { found: SiteImportFound; showNotes: boolean }) {
  return (
    <Card title={t("siteImport.foundTitle")}>
      <p className="text-body text-label">{describeFound(found)}</p>
      {showNotes && found.notes.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          <h3 className="text-headline text-label">{t("siteImport.notesTitle")}</h3>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-footnote text-label-secondary">
            {found.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
