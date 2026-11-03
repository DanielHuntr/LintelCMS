import { ReportSection } from "../data-tools/WordPressReport.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { SiteImportItemKind, SiteImportReport } from "./siteImport.api.js";

const shownKinds: SiteImportItemKind[] = [
  "entry",
  "media",
  "contentType",
  "taxonomy",
  "term",
  "menu",
  "global",
];

/** What an import did (or, from a dry run, would do), in sections people can act on. */
export function SiteImportReportView({ report }: { report: SiteImportReport }) {
  const rows = shownKinds.filter((kind) => {
    const counts = report.counts[kind];
    return counts.done + counts.skipped + counts.failed > 0;
  });
  return (
    <div className="flex flex-col gap-6">
      <table className="w-full text-start text-body text-label">
        <thead className="text-footnote text-label-secondary">
          <tr>
            <th scope="col" className="pb-2 text-start font-medium">
              {t("wordpress.column.what")}
            </th>
            <th scope="col" className="pb-2 text-end font-medium">
              {t("wordpress.column.done")}
            </th>
            <th scope="col" className="pb-2 text-end font-medium">
              {t("wordpress.column.skipped")}
            </th>
            <th scope="col" className="pb-2 text-end font-medium">
              {t("wordpress.column.failed")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((kind) => (
            <tr key={kind} className="hairline-top">
              <th scope="row" className="py-2 text-start font-normal">
                {t(`siteImport.count.${kind}` as StringKey)}
              </th>
              <td className="py-2 text-end tabular-nums">{report.counts[kind].done}</td>
              <td className="py-2 text-end tabular-nums text-label-secondary">
                {report.counts[kind].skipped}
              </td>
              <td
                className={`py-2 text-end tabular-nums ${report.counts[kind].failed > 0 ? "text-danger" : "text-label-secondary"}`}
              >
                {report.counts[kind].failed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.createdTypes.length > 0 && (
        <ReportSection title={t("siteImport.createdTitle")}>{report.createdTypes}</ReportSection>
      )}
      {report.designedPages.length > 0 && (
        <ReportSection title={t("siteImport.designedTitle")} text={t("siteImport.designedText")}>
          {report.designedPages}
        </ReportSection>
      )}
      {report.renamedSlugs.length > 0 && (
        <ReportSection title={t("wordpress.renamedTitle")}>
          {report.renamedSlugs.map((renamed) => t("wordpress.renamed", renamed))}
        </ReportSection>
      )}
      {report.fieldsLeftOut.length > 0 && (
        <ReportSection title={t("siteImport.leftOutTitle")} text={t("siteImport.leftOutText")}>
          {report.fieldsLeftOut.map((item) => `${item.title}: ${item.fields.join(", ")}`)}
        </ReportSection>
      )}
      {report.redirectsSuggested > 0 && (
        <p className="text-body text-label">
          {t("wordpress.redirectsSuggested", { count: report.redirectsSuggested })}
        </p>
      )}
      {report.notes.length > 0 && (
        <ReportSection title={t("siteImport.notesTitle")}>{report.notes}</ReportSection>
      )}
      {report.problems.length > 0 && (
        <ReportSection title={t("wordpress.problemsTitle")} tone="danger">
          {report.problems.map((problem) => t("wordpress.problem", problem))}
        </ReportSection>
      )}
    </div>
  );
}
