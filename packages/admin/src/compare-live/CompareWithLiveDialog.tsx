import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ImageOff } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import type { Field } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { useAsset } from "../media/media.queries.js";
import { formatDateTime } from "../content/relativeTime.js";
import type { ViewPageTarget } from "../content/viewPage.js";
import { ViewPageLink } from "../content/ViewPageLink.js";
import { type FieldChange, listFieldChanges } from "./fieldChanges.js";
import { getLiveVersion } from "./liveVersion.api.js";
import type { DiffPart } from "./textDiff.js";

interface CompareWithLiveDialogProps {
  entryId: string;
  fields: readonly Field[];
  /** The values in the editor now: what publishing would put live. */
  current: Readonly<Record<string, unknown>>;
  /** True while the editor holds changes that aren't saved yet. */
  hasUnsavedChanges: boolean;
  /** Where the live page is, for "View the live page" beside a changed design. */
  viewPage: ViewPageTarget | undefined;
  onClose: () => void;
}

/**
 * Every field that differs from the version the website shows, one after another. Text
 * shows the words removed and added, marked by more than colour: removed words are struck
 * through and added ones underlined, and screen readers hear "removed:" and "added:".
 * A page design says "Design changed", with a link to the live page.
 */
export function CompareWithLiveDialog({
  entryId,
  fields,
  current,
  hasUnsavedChanges,
  viewPage,
  onClose,
}: CompareWithLiveDialogProps) {
  const live = useQuery({
    queryKey: ["entries", entryId, "live"],
    queryFn: () => getLiveVersion(entryId),
    staleTime: 0,
  });
  const words = {
    on: t("compareLive.on"),
    off: t("compareLive.off"),
    empty: t("compareLive.empty"),
  };
  const changes = live.data?.data ? listFieldChanges(fields, live.data.data, current, words) : [];
  const publishedAt = live.data?.publishedAt;

  return (
    <Dialog
      open
      onClose={onClose}
      size="wide"
      title={t("compareLive.title")}
      description={
        publishedAt
          ? t("compareLive.description", { date: formatDateTime(publishedAt) })
          : t("compareLive.descriptionNoDate")
      }
      footer={
        <Button variant="filled" onClick={onClose} data-autofocus>
          {t("compareLive.done")}
        </Button>
      }
    >
      {live.isPending && (
        <LoadingRegion label={t("compareLive.loading")}>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-16" />
          </div>
        </LoadingRegion>
      )}
      {live.isError && <LoadError error={live.error} onRetry={() => void live.refetch()} />}
      {live.data && !live.data.data && (
        <p className="text-body text-label-secondary">{t("compareLive.notLive")}</p>
      )}
      {live.data?.data && changes.length === 0 && (
        <p className="text-body text-label-secondary">{t("compareLive.nothingChanged")}</p>
      )}
      {changes.length > 0 && (
        <>
          <p className="mb-4 text-footnote text-label-secondary">
            {t("compareLive.legend")}
            {hasUnsavedChanges && <> {t("compareLive.unsavedNote")}</>}
          </p>
          <ol className="flex flex-col">
            {changes.map((change) => (
              <li
                key={change.handle}
                className="flex flex-col gap-2 py-4 hairline-top first:pt-0 first:[box-shadow:none]"
              >
                <h3 className="text-headline text-label">{change.label}</h3>
                <ChangeDetail change={change} viewPage={viewPage} />
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  );
}

function ChangeDetail({
  change,
  viewPage,
}: {
  change: FieldChange;
  viewPage: ViewPageTarget | undefined;
}) {
  switch (change.kind) {
    case "text":
      return <WordChanges parts={change.parts} />;
    case "picture":
      return (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <PictureSide label={t("compareLive.live")} assetId={change.before} />
          <PictureSide label={t("compareLive.now")} assetId={change.after} />
        </div>
      );
    case "design":
      return (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-label">
          {t("compareLive.designChanged")}
          {viewPage && (
            <ViewPageLink
              target={viewPage}
              className="inline-flex items-center gap-1 text-accent hover:underline focus-visible:focus-ring"
            >
              {t("compareLive.viewLivePage")}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </ViewPageLink>
          )}
        </p>
      );
    case "value":
      return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body">
          <dt className="text-label-secondary">{t("compareLive.live")}</dt>
          <dd className="text-label">{change.before}</dd>
          <dt className="text-label-secondary">{t("compareLive.now")}</dt>
          <dd className="font-medium text-label">{change.after}</dd>
        </dl>
      );
    case "other":
      return <p className="text-body text-label-secondary">{t("compareLive.otherChanged")}</p>;
  }
}

/** The text with its changes marked, keeping line breaks as they were written. */
function WordChanges({ parts }: { parts: readonly DiffPart[] }) {
  return (
    <p className="text-body whitespace-pre-wrap text-label">
      {parts.map((part, index) => {
        if (part.kind === "same") return <span key={index}>{part.text}</span>;
        if (part.kind === "removed") {
          return (
            <del
              key={index}
              className={classNames(
                "rounded-[3px] bg-danger/12 text-label-secondary line-through decoration-danger decoration-2",
                // A little room before the words that replace it, so the two don't run together.
                parts[index + 1]?.kind === "added" && "me-1",
              )}
            >
              <span className="sr-only">{t("compareLive.removed")} </span>
              {part.text}
              <span className="sr-only"> {t("compareLive.removedEnd")}</span>
            </del>
          );
        }
        return (
          <ins
            key={index}
            className="rounded-[3px] bg-success/14 text-label underline decoration-success decoration-2 underline-offset-[3px]"
          >
            <span className="sr-only">{t("compareLive.added")} </span>
            {part.text}
            <span className="sr-only"> {t("compareLive.addedEnd")}</span>
          </ins>
        );
      })}
    </p>
  );
}

function PictureSide({ label, assetId }: { label: string; assetId: string | null }) {
  const asset = useAsset(assetId);
  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-control bg-fill text-label-tertiary">
        {asset.data?.thumbnailUrl ? (
          <img
            src={asset.data.thumbnailUrl}
            alt={asset.data.alt}
            className="size-full object-cover"
          />
        ) : (
          assetId === null && <ImageOff aria-hidden="true" className="size-6" />
        )}
      </div>
      <figcaption className="truncate text-footnote text-label-secondary">
        {label}: {assetId === null ? t("compareLive.noPicture") : (asset.data?.filename ?? "")}
      </figcaption>
    </figure>
  );
}
