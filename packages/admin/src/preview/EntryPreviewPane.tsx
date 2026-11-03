import { Link } from "@tanstack/react-router";
import { ExternalLink, MonitorSmartphone, RotateCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LoadError } from "../api/LoadError.js";
import type { Collection, Entry } from "../content/content.types.js";
import { classNames } from "../design/classNames.js";
import { EmptyState } from "../design/EmptyState.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import type { Field } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { BuiltInPreview } from "./BuiltInPreview.js";
import { usePreviewedDraft, usePreviewToken } from "./preview.queries.js";

type PreviewSize = "desktop" | "tablet" | "phone";

/** Widths of common screens, so editors can check a page the way visitors will see it. */
const frameWidths: Record<PreviewSize, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "390px",
};

interface EntryPreviewPaneProps {
  id: string;
  collection: Collection;
  /** Undefined until a new entry has been saved for the first time. */
  entry: Entry | undefined;
  fields: readonly Field[];
  title: string;
  onClose: () => void;
}

/**
 * The right half of the editor's split view: the page as the site renders it. With a
 * preview address, the website itself is shown in a frame; without one, Lintel draws a
 * simple version from the same data the site would get. Both follow every save.
 */
export function EntryPreviewPane({
  id,
  collection,
  entry,
  fields,
  title,
  onClose,
}: EntryPreviewPaneProps) {
  const [size, setSize] = useState<PreviewSize>("desktop");
  const [reloads, setReloads] = useState(0);
  const preview = usePreviewToken(entry?.id);
  const previewUrl = preview.data?.previewUrl ?? null;

  return (
    <aside
      id={id}
      aria-label={t("preview.title")}
      className="flex h-[calc(100vh-9rem)] @min-[52rem]:sticky @min-[52rem]:top-20 min-h-96 min-w-0 flex-col overflow-hidden rounded-panel bg-surface"
    >
      <header className="flex shrink-0 items-center gap-2 px-4 py-2.5 hairline-bottom">
        <h2 className="text-headline text-label">{t("preview.title")}</h2>
        <div className="ms-auto flex items-center gap-1">
          <SegmentedControl
            label={t("preview.sizeLabel")}
            value={size}
            onChange={setSize}
            options={[
              { value: "desktop", label: t("preview.size.desktop") },
              { value: "tablet", label: t("preview.size.tablet") },
              { value: "phone", label: t("preview.size.phone") },
            ]}
          />
          <PaneButton
            label={t("preview.refresh")}
            onClick={() => {
              setReloads((count) => count + 1);
              void preview.refetch();
            }}
            disabled={!entry}
          >
            <RotateCw aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </PaneButton>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t("preview.openInNewTab")}
              title={t("preview.openInNewTab")}
              className="flex size-8 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring"
            >
              <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-4" />
            </a>
          )}
          <PaneButton label={t("preview.close")} onClick={onClose} disabled={false}>
            <X aria-hidden="true" strokeWidth={2} className="size-4" />
          </PaneButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-background p-3">
        <div
          className="mx-auto h-full overflow-hidden rounded-card bg-surface shadow-float transition-[max-width] duration-200 ease-standard"
          style={{ maxWidth: frameWidths[size] }}
        >
          {!entry ? (
            <EmptyState
              icon={MonitorSmartphone}
              title={t("preview.notSavedTitle")}
              description={t("preview.notSavedDescription")}
            />
          ) : preview.isError ? (
            <LoadError error={preview.error} onRetry={() => void preview.refetch()} />
          ) : !preview.data ? (
            <PreviewSkeleton />
          ) : previewUrl ? (
            <iframe
              // A new key reloads the page after each save, and when Reload is pressed.
              key={`${entry.updatedAt}:${reloads}`}
              src={previewUrl}
              title={t("preview.frameTitle", { title: title || t("preview.untitled") })}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="size-full border-0 bg-surface"
            />
          ) : (
            <BuiltInPreviewFrame
              token={preview.data.token}
              savedAt={`${entry.updatedAt}:${reloads}`}
              fields={fields}
              collection={collection}
            />
          )}
        </div>
      </div>
      <p className="shrink-0 px-4 py-2 text-caption text-label-secondary hairline-top">
        {t("preview.updates")}
      </p>
    </aside>
  );
}

function BuiltInPreviewFrame({
  token,
  savedAt,
  fields,
  collection,
}: {
  token: string;
  savedAt: string;
  fields: readonly Field[];
  collection: Collection;
}) {
  const draft = usePreviewedDraft(token, savedAt);
  const canConnect = useCan("collections:update");

  return (
    <div className="h-full overflow-y-auto">
      <div className="m-3 flex flex-col gap-0.5 rounded-card bg-accent/10 px-4 py-3">
        <p className="text-footnote font-medium text-label">{t("preview.noSiteTitle")}</p>
        <p className="text-footnote text-label-secondary">{t("preview.noSiteDescription")}</p>
        {canConnect && (
          <Link
            to="/build/content-types/$handle"
            params={{ handle: collection.blueprintHandle }}
            hash="live-preview"
            className="mt-1 self-start text-footnote font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
          >
            {t("preview.noSiteLink")}
          </Link>
        )}
      </div>
      {draft.isError && <LoadError error={draft.error} onRetry={() => void draft.refetch()} />}
      {!draft.data && !draft.isError && <PreviewSkeleton />}
      {draft.data && <BuiltInPreview entry={draft.data.entry} fields={fields} />}
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <LoadingRegion label={t("preview.loading")}>
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </LoadingRegion>
  );
}

function PaneButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "flex size-8 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard",
        "hover:bg-fill hover:text-label focus-visible:focus-ring disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
