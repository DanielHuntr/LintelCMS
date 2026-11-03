import { ImageOff, Images } from "lucide-react";
import { LoadError } from "../../api/LoadError.js";
import { EmptyState } from "../../design/EmptyState.js";
import { LinkButton } from "../../design/LinkButton.js";
import { LoadingRegion } from "../../design/LoadingRegion.js";
import { Skeleton } from "../../design/Skeleton.js";
import { t } from "../../i18n/strings.js";
import { useMediaUsage } from "../dashboard.queries.js";

/** "1.2 GB": the largest unit that keeps the number at least 1. */
export function formatFileSize(bytes: number): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  return new Intl.NumberFormat("en", {
    style: "unit",
    unit: units[unitIndex],
    unitDisplay: unitIndex === 0 ? "long" : "short",
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value);
}

/** How many files there are, what they take up, and images missing a description. */
export function MediaUsageWidget() {
  const usage = useMediaUsage();

  if (usage.isError) {
    return <LoadError error={usage.error} onRetry={() => void usage.refetch()} />;
  }
  if (!usage.data) {
    return (
      <LoadingRegion label={t("dashboard.loading")}>
        <Skeleton className="h-16 w-full" />
      </LoadingRegion>
    );
  }
  const { fileCount, totalBytes, imagesWithoutAltText } = usage.data;
  if (fileCount === 0) {
    return (
      <EmptyState
        icon={Images}
        title={t("dashboard.media.emptyTitle")}
        description={t("dashboard.media.emptyDescription")}
        action={
          <LinkButton to="/media" variant="tinted" size="small">
            {t("dashboard.media.open")}
          </LinkButton>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        <span className="block text-title text-label">
          {t("dashboard.media.files", { count: fileCount })}
        </span>
        <span className="text-footnote text-label-secondary">
          {t("dashboard.media.size", { size: formatFileSize(totalBytes) })}
        </span>
      </p>
      <p className="flex items-start gap-2 text-footnote text-label-secondary">
        {imagesWithoutAltText > 0 && (
          <ImageOff
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
        )}
        {imagesWithoutAltText > 0
          ? t("dashboard.media.missingAlt", { count: imagesWithoutAltText })
          : t("dashboard.media.allDescribed")}
      </p>
      {/* Its own width, not the card's: a full-width pill read as a progress bar. */}
      <div className="self-start">
        <LinkButton to="/media" variant="tinted" size="small">
          {t("dashboard.media.open")}
        </LinkButton>
      </div>
    </div>
  );
}
