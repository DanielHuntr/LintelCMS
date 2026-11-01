import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { ImportFilesStep } from "./ImportFilesStep.js";
import { ImportMappingStep } from "./ImportMappingStep.js";
import { ImportProgressStep } from "./ImportProgressStep.js";
import { ImportReportView } from "./ImportReportView.js";
import type { ShopifyImport } from "./shopifyImport.api.js";
import { useShopifyImport, useShopifyImports } from "./shopifyImport.queries.js";
import { usePrimaryCurrency } from "./shopSettings.queries.js";

/**
 * /commerce/import/shopify: moving a shop over from Shopify's CSV exports, in four steps:
 * choose the files, check the preview and choices (with an optional dry run), import, and
 * read the report. An unfinished import is offered again when the screen is opened.
 */
export function ShopifyImportPage() {
  const [importId, setImportId] = useState<string | null>(null);
  const [startAgain, setStartAgain] = useState(false);
  const imports = useShopifyImports();
  const unfinished = imports.data?.find((item) => item.status !== "completed");
  const chosenId = importId ?? (startAgain ? null : (unfinished?.id ?? null));
  const job = useShopifyImport(chosenId);
  const currency = usePrimaryCurrency();

  return (
    <>
      <BackLink to="/commerce">{t("shop.title")}</BackLink>
      <LargeTitle title={t("shop.import.title")} subtitle={t("shop.import.subtitle")} />
      {imports.isPending && (
        <LoadingRegion label={t("shop.import.loading")}>
          <Skeleton className="h-48 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {(imports.error ?? job.error) && (
        <LoadError
          error={imports.error ?? job.error}
          onRetry={() => void (imports.error ? imports.refetch() : job.refetch())}
        />
      )}
      {!imports.isPending && !currency && (
        <Card className="max-w-2xl">
          <p className="mb-3 text-body text-label-secondary">{t("shop.import.needsMarket")}</p>
          <LinkButton to="/commerce/settings/markets">
            {t("shop.products.needsMarketAction")}
          </LinkButton>
        </Card>
      )}
      {!imports.isPending && currency && !chosenId && (
        <ImportFilesStep
          onRead={(started) => {
            setStartAgain(false);
            setImportId(started.id);
          }}
        />
      )}
      {job.data && (
        <ImportStep
          job={job.data}
          onStartAgain={() => {
            setImportId(null);
            setStartAgain(true);
          }}
        />
      )}
    </>
  );
}

function ImportStep({ job, onStartAgain }: { job: ShopifyImport; onStartAgain: () => void }) {
  if (job.status === "ready") {
    return (
      <div className="flex flex-col gap-4">
        <ImportMappingStep job={job} />
        <div>
          <Button variant="plain" onClick={onStartAgain}>
            {t("shop.import.otherFiles")}
          </Button>
        </div>
      </div>
    );
  }
  if (job.status === "importing") return <ImportProgressStep job={job} />;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card title={t("shop.import.doneHeader")}>
        <p className="mb-5 text-body text-label-secondary">{t("shop.import.doneBody")}</p>
        <ImportReportView report={job.report} />
      </Card>
      <div className="flex flex-wrap gap-3">
        <LinkButton to="/commerce/products">{t("shop.import.seeProducts")}</LinkButton>
        <Button variant="tinted" onClick={onStartAgain}>
          {t("shop.import.another")}
        </Button>
      </div>
    </div>
  );
}
