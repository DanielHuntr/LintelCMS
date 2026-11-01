import { hasPermission } from "@lintel/core/permissions";
import { ImagePlus, Search, TriangleAlert, Upload } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { AssetDetailSheet } from "./AssetDetailSheet.js";
import { AssetGrid, AssetGridPlaceholder } from "./AssetGrid.js";
import { DropOverlay } from "./DropOverlay.js";
import type { AssetKind } from "./media.api.js";
import { useAssetList, useRefreshAssetLists } from "./media.queries.js";
import { acceptedFileTypes } from "./upload-rules.js";
import { UploadTray } from "./UploadTray.js";
import { useDebouncedValue } from "./useDebouncedValue.js";
import { useFileDrop } from "./useFileDrop.js";
import { useUploadQueue } from "./useUploadQueue.js";

type Filter = "all" | AssetKind;

const SEARCH_DELAY_MILLISECONDS = 250;

/** The media library at /media: every uploaded file, searchable, with uploads by button or drop. */
export function MediaLibraryPage({
  permissions,
  initialAssetId,
  initialSearch,
}: {
  permissions: readonly string[];
  /** A file whose details open straight away, such as one picked in search. */
  initialAssetId?: string;
  initialSearch?: string;
}) {
  const canUpload = hasPermission(permissions, "media:upload");
  const [search, setSearch] = useState(initialSearch ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [openAssetId, setOpenAssetId] = useState<string | null>(initialAssetId ?? null);
  const fileInput = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DELAY_MILLISECONDS);
  const assetList = useAssetList(debouncedSearch, filter === "all" ? undefined : filter);
  const refreshLists = useRefreshAssetLists();
  const uploads = useUploadQueue({ onUploaded: () => void refreshLists() });
  const isDraggingFiles = useFileDrop(uploads.addFiles, { enabled: canUpload });

  const assets = assetList.data?.pages.flatMap((page) => page.assets) ?? [];
  const total = assetList.data?.pages[0]?.total;
  const openIndex = assets.findIndex((asset) => asset.id === openAssetId);
  const openAsset = assets[openIndex];
  // A library with nothing in it at all gets the guide alone, not a search box for nothing.
  const isLibraryEmpty = total === 0 && !debouncedSearch.trim() && filter === "all";

  function chooseFiles() {
    fileInput.current?.click();
  }

  return (
    <>
      <LargeTitle
        title={t("media.title")}
        subtitle={
          total === undefined || isLibraryEmpty ? undefined : t("media.count", { count: total })
        }
        actions={
          canUpload &&
          !isLibraryEmpty && (
            <Button icon={<Upload aria-hidden="true" />} onClick={chooseFiles}>
              {t("media.upload")}
            </Button>
          )
        }
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={acceptedFileTypes}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          uploads.addFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />

      <div
        hidden={isLibraryEmpty}
        className="mb-6 flex flex-wrap items-start gap-x-4 gap-y-3 [&[hidden]]:hidden"
      >
        <div className="relative w-full max-w-sm">
          <TextField
            type="search"
            label={t("media.search.label")}
            placeholder={t("media.search.placeholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="[&_input]:ps-9"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 inset-s-3 size-4 text-label-tertiary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-footnote font-medium text-label">
            {t("media.filter.label")}
          </span>
          {/* As tall as the search field, so the two sit on one line. */}
          <div className="flex h-10 items-center">
            <SegmentedControl
              label={t("media.filter.label")}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t("media.filter.all") },
                { value: "image", label: t("media.filter.images") },
                { value: "document", label: t("media.filter.documents") },
              ]}
            />
          </div>
        </div>
      </div>

      <LibraryContents
        state={
          assetList.isPending
            ? "loading"
            : assetList.isError
              ? "error"
              : assets.length === 0
                ? "empty"
                : "ready"
        }
        errorMessage={assetList.error?.message}
        onRetry={() => void assetList.refetch()}
        emptyState={
          <LibraryEmptyState
            search={debouncedSearch}
            filter={filter}
            onUpload={canUpload ? chooseFiles : undefined}
          />
        }
      >
        <AssetGrid
          assets={assets}
          label={t("media.grid.label")}
          onActivate={(asset) => setOpenAssetId(asset.id)}
        />
        {assetList.hasNextPage && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="tinted"
              onClick={() => void assetList.fetchNextPage()}
              disabled={assetList.isFetchingNextPage}
            >
              {t("media.showMore")}
            </Button>
          </div>
        )}
      </LibraryContents>

      {openAsset && (
        <AssetDetailSheet
          key={openAsset.id}
          asset={openAsset}
          canUpdate={hasPermission(permissions, "media:update")}
          canDelete={hasPermission(permissions, "media:delete")}
          onClose={() => setOpenAssetId(null)}
          onPrevious={
            openIndex > 0 ? () => setOpenAssetId(assets[openIndex - 1]?.id ?? null) : undefined
          }
          onNext={
            openIndex < assets.length - 1
              ? () => setOpenAssetId(assets[openIndex + 1]?.id ?? null)
              : undefined
          }
        />
      )}
      <UploadTray
        items={uploads.items}
        onDismiss={uploads.dismiss}
        onClose={uploads.clearFinished}
      />
      <DropOverlay visible={isDraggingFiles} />
    </>
  );
}

function LibraryContents({
  state,
  errorMessage,
  onRetry,
  emptyState,
  children,
}: {
  state: "loading" | "error" | "empty" | "ready";
  errorMessage: string | undefined;
  onRetry: () => void;
  emptyState: ReactNode;
  children: ReactNode;
}) {
  if (state === "loading") return <AssetGridPlaceholder label={t("media.loading")} />;
  if (state === "error") {
    return (
      <Card>
        <EmptyState
          size="page"
          icon={TriangleAlert}
          title={t("media.loadError.title")}
          description={errorMessage}
          action={
            <Button variant="tinted" onClick={onRetry}>
              {t("media.retry")}
            </Button>
          }
        />
      </Card>
    );
  }
  if (state === "empty") return <Card>{emptyState}</Card>;
  return <>{children}</>;
}

/** Says why there's nothing to show, and what to do about it. */
function LibraryEmptyState({
  search,
  filter,
  onUpload,
}: {
  search: string;
  filter: Filter;
  onUpload: (() => void) | undefined;
}) {
  if (search.trim()) {
    return (
      <EmptyState
        size="page"
        icon={Search}
        title={t("media.noResults.title")}
        description={t("media.noResults.description", { search: search.trim() })}
      />
    );
  }
  if (filter !== "all") {
    return (
      <EmptyState
        size="page"
        icon={ImagePlus}
        title={filter === "image" ? t("media.noImages.title") : t("media.noDocuments.title")}
        description={t("media.noKind.description")}
      />
    );
  }
  return (
    <EmptyState
      size="page"
      icon={ImagePlus}
      title={t("media.empty.title")}
      description={t("media.empty.description")}
      action={
        onUpload && (
          <Button icon={<Upload aria-hidden="true" />} onClick={onUpload}>
            {t("media.empty.action")}
          </Button>
        )
      }
    />
  );
}
