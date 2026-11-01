import { t } from "../i18n/strings.js";
import { fileKindLabel, formatDimensions, formatFileSize, formatUploadDate } from "./formatting.js";
import type { Asset } from "./media.api.js";

/** The facts about a file, as label and value pairs, like a Get Info window. */
export function AssetDetailsList({ asset }: { asset: Asset }) {
  const dimensions = formatDimensions(asset);
  const rows: [string, string][] = [
    [t("media.detail.type"), fileKindLabel(asset)],
    [t("media.detail.size"), formatFileSize(asset.size)],
    ...(dimensions ? [[t("media.detail.dimensions"), dimensions] as [string, string]] : []),
    [t("media.detail.uploadedBy"), asset.uploadedBy?.name ?? t("media.detail.formerUser")],
    [t("media.detail.uploadedAt"), formatUploadDate(asset.createdAt)],
  ];

  return (
    <section aria-labelledby="asset-details-title">
      <h3 id="asset-details-title" className="mb-1 text-footnote font-semibold text-label">
        {t("media.detail.details")}
      </h3>
      <dl>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 py-2 text-footnote not-first:hairline-top"
          >
            <dt className="text-label-secondary">{label}</dt>
            <dd className="truncate text-right text-label">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
