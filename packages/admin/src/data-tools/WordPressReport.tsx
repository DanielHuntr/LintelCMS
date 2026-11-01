import { t, type StringKey } from "../i18n/strings.js";
import type { WordPressImportReport, WordPressItemKind } from "./wordpressImport.api.js";

const shownKinds: WordPressItemKind[] = [
  "post",
  "page",
  "attachment",
  "image",
  "author",
  "category",
  "tag",
  "product",
  "menu",
];

/** What an import did (or, from a dry run, would do), in sections people can act on. */
export function WordPressReport({ report }: { report: WordPressImportReport }) {
  const rows = shownKinds.filter((kind) => {
    const counts = report.counts[kind] ?? { done: 0, skipped: 0, failed: 0 };
    return counts.done + counts.skipped + counts.failed > 0;
  });
  const keptAsHtml = Object.entries(report.keptAsHtml);

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
                {t(`wordpress.count.${kind}` as StringKey)}
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

      {report.invitedPeople.length > 0 && (
        <ReportSection title={t("wordpress.invitedTitle")} text={t("wordpress.invitedText")}>
          {report.invitedPeople.map((person) => `${person.name} <${person.email}>`)}
        </ReportSection>
      )}
      {keptAsHtml.length > 0 && (
        <ReportSection
          title={t("wordpress.htmlTitle")}
          text={`${keptAsHtml.map(([kind, count]) => `${count} × ${kind === "image" ? t("wordpress.htmlKind.image") : kind}`).join(", ")}. ${t("wordpress.htmlText")}`}
        >
          {report.entriesWithHtml.map((entry) => `${entry.title} (${entry.kinds.join(", ")})`)}
        </ReportSection>
      )}
      {report.renamedSlugs.length > 0 && (
        <ReportSection title={t("wordpress.renamedTitle")}>
          {report.renamedSlugs.map((renamed) => t("wordpress.renamed", renamed))}
        </ReportSection>
      )}
      {(report.fieldsLeftOut ?? []).length > 0 && (
        <ReportSection title={t("wordpress.fieldsLeftOutTitle")} text={t("siteImport.leftOutText")}>
          {(report.fieldsLeftOut ?? []).map((item) => `${item.title}: ${item.fields.join(", ")}`)}
        </ReportSection>
      )}
      {report.redirectsSuggested > 0 && (
        <p className="text-body text-label">
          {t("wordpress.redirectsSuggested", { count: report.redirectsSuggested })}
        </p>
      )}
      {report.problems.length > 0 && (
        <ReportSection title={t("wordpress.problemsTitle")} tone="danger">
          {report.problems.map((problem) => t("wordpress.problem", problem))}
        </ReportSection>
      )}
    </div>
  );
}

/** A titled list in an import report. Shared by the importers. */
export function ReportSection({
  title,
  text,
  tone = "neutral",
  children,
}: {
  title: string;
  text?: string;
  tone?: "neutral" | "danger";
  children: string[];
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className={`text-headline ${tone === "danger" ? "text-danger" : "text-label"}`}>
        {title}
      </h3>
      {text && <p className="text-footnote text-label-secondary">{text}</p>}
      <ul className="flex list-disc flex-col gap-0.5 ps-5 text-footnote text-label">
        {children.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
