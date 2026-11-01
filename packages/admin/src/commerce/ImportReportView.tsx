import { Download } from "lucide-react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { groupProblems, redirectsCsv } from "./importReport.js";
import type { ImportReport } from "./shopifyImport.api.js";

/**
 * What an import brought in, what it didn't and why, and the redirects to add. Used for the
 * final report and, with `wouldHappen`, for the dry run.
 */
export function ImportReportView({
  report,
  wouldHappen = false,
}: {
  report: ImportReport;
  wouldHappen?: boolean;
}) {
  const rows = [
    { label: t("shop.import.report.products"), counts: report.products },
    { label: t("shop.import.report.collections"), counts: report.collections },
    { label: t("shop.import.report.customers"), counts: report.customers },
    { label: t("shop.import.report.orders"), counts: report.orders },
  ];
  const problems = groupProblems(report.problems);

  return (
    <div className="flex flex-col gap-5">
      <table className="w-full text-start text-body">
        <thead>
          <tr className="text-footnote text-label-secondary">
            <th scope="col" className="pb-2 font-medium">
              <span className="sr-only">{t("shop.import.report.what")}</span>
            </th>
            <th scope="col" className="pb-2 text-end font-medium">
              {wouldHappen ? t("shop.import.report.wouldCreate") : t("shop.import.report.created")}
            </th>
            <th scope="col" className="pb-2 text-end font-medium">
              {t("shop.import.report.skipped")}
            </th>
            <th scope="col" className="pb-2 text-end font-medium">
              {t("shop.import.report.failed")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-separator">
              <th scope="row" className="py-1.5 font-normal text-label">
                {row.label}
              </th>
              <td className="py-1.5 text-end tabular-nums text-label">{row.counts.created}</td>
              <td className="py-1.5 text-end tabular-nums text-label-secondary">
                {row.counts.skipped}
              </td>
              <td
                className={`py-1.5 text-end tabular-nums ${row.counts.failed > 0 ? "text-danger" : "text-label-secondary"}`}
              >
                {row.counts.failed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-footnote text-label-secondary">
        {t(wouldHappen ? "shop.import.report.photosWould" : "shop.import.report.photos", {
          downloaded: report.images.downloaded,
          skipped: report.images.skipped,
        })}
      </p>

      {problems.length > 0 && (
        <section aria-labelledby="import-problems" className="flex flex-col gap-2">
          <h3 id="import-problems" className="text-headline text-label">
            {t("shop.import.report.problemsHeader")}
          </h3>
          <ul className="flex flex-col divide-y divide-separator rounded-control bg-fill/40">
            {problems.map((problem) => (
              <li key={`${problem.stage}:${problem.item}`} className="px-3 py-2">
                <p className="text-body font-medium text-label">{problem.item}</p>
                <ul className="text-footnote text-label-secondary">
                  {problem.messages.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!wouldHappen && report.redirects.length > 0 && (
        <section aria-labelledby="import-redirects" className="flex flex-col gap-2">
          <h3 id="import-redirects" className="text-headline text-label">
            {t("shop.import.report.redirectsHeader")}
          </h3>
          <p className="text-footnote text-label-secondary">
            {t("shop.import.report.redirectsBody")}
          </p>
          <ul className="flex max-h-56 flex-col overflow-y-auto text-footnote">
            {report.redirects.map((redirect) => (
              <li key={redirect.fromPath} className="flex gap-2 py-0.5">
                <code className="text-label-secondary">{redirect.fromPath}</code>
                <span aria-hidden="true">→</span>
                <span className="sr-only">{t("shop.import.report.goesTo")}</span>
                <code className="text-label">{redirect.toPath}</code>
              </li>
            ))}
          </ul>
          <div>
            <Button
              variant="tinted"
              icon={<Download aria-hidden="true" />}
              onClick={() =>
                downloadText("redirects-from-shopify.csv", redirectsCsv(report.redirects))
              }
            >
              {t("shop.import.report.downloadRedirects")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
