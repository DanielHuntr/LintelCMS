import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Check, ExternalLink, Search, TriangleAlert, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { Asset } from "../media/media.api.js";
import { AssetGridPlaceholder } from "../media/AssetGrid.js";
import { Modal } from "../media/Modal.js";
import { addFreePhoto, type FreePhoto, searchFreePhotos } from "./freePhotos.api.js";
import { useFreePhotoThumbnail } from "./useFreePhotoThumbnail.js";

interface FreePhotosDialogProps {
  /**
   * "add" puts photos in the media library and stays open, for the library. "choose" adds
   * the photo and hands it back straight away, for an image field.
   */
  mode: "add" | "choose";
  /** For "choose": the field being filled, shown under the title. */
  fieldLabel?: string;
  /** A site's handle to add into its folder; left out, the shared library. */
  folder?: string;
  onAdded: (asset: Asset) => void;
  onClose: () => void;
}

/**
 * Searches free photos (Openverse, through Lintel's API) and adds one to the media library
 * with its credit. Every result shows its creator and licence; only licences a business may
 * use without asking are ever listed (the API checks).
 */
export function FreePhotosDialog({
  mode,
  fieldLabel,
  folder,
  onAdded,
  onClose,
}: FreePhotosDialogProps) {
  const titleId = useId();
  const footerId = useId();
  const [typed, setTyped] = useState("");
  const [searchText, setSearchText] = useState("");
  const results = useInfiniteQuery({
    queryKey: ["free-photos", "search", searchText],
    queryFn: ({ pageParam }) => searchFreePhotos(searchText, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    enabled: searchText !== "",
    retry: false,
    staleTime: 5 * 60_000,
  });
  const photos = results.data?.pages.flatMap((page) => page.photos) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    setSearchText(typed.trim());
  }

  return (
    <Modal size="dialog" labelledBy={titleId} describedBy={footerId} onClose={onClose}>
      <header className="flex shrink-0 items-start gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-title text-label">
            {t("freePhotos.title")}
          </h2>
          {fieldLabel && (
            <p className="truncate text-footnote text-label-secondary">
              {t("freePhotos.forField", { field: fieldLabel })}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={t("media.detail.close")}
          onClick={onClose}
          className="-me-2 flex size-8 items-center justify-center rounded-full text-label-secondary transition-colors duration-150 hover:bg-fill hover:text-label focus-visible:focus-ring"
        >
          <X aria-hidden="true" className="size-[18px]" />
        </button>
      </header>

      <form role="search" onSubmit={submit} className="flex shrink-0 items-end gap-3 px-6 pb-4">
        <div className="relative flex-1">
          <TextField
            data-autofocus
            type="search"
            label={t("freePhotos.search.label")}
            placeholder={t("freePhotos.search.placeholder")}
            value={typed}
            maxLength={200}
            onChange={(event) => setTyped(event.target.value)}
            className="[&_input]:ps-9"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 inset-s-3 size-4 text-label-tertiary"
          />
        </div>
        <Button type="submit" variant="tinted" className="h-10" disabled={!typed.trim()}>
          {t("freePhotos.search.submit")}
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 pb-4">
        {searchText === "" ? (
          <EmptyState
            size="page"
            icon={Search}
            title={t("freePhotos.start.title")}
            description={t("freePhotos.start.description")}
          />
        ) : results.isPending ? (
          <AssetGridPlaceholder label={t("freePhotos.searching")} />
        ) : results.isError ? (
          <EmptyState
            size="page"
            icon={TriangleAlert}
            title={t("freePhotos.error.title")}
            description={describeFreePhotoError(results.error)}
            action={
              <Button variant="tinted" onClick={() => void results.refetch()}>
                {t("freePhotos.retry")}
              </Button>
            }
          />
        ) : photos.length === 0 ? (
          <EmptyState
            size="page"
            icon={Search}
            title={t("freePhotos.noResults.title")}
            description={t("freePhotos.noResults.description", { search: searchText })}
          />
        ) : (
          <>
            <ul
              aria-label={t("freePhotos.resultsLabel", { search: searchText })}
              className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-6"
            >
              {photos.map((photo) => (
                <FreePhotoResult
                  key={photo.id}
                  photo={photo}
                  mode={mode}
                  folder={folder}
                  onAdded={onAdded}
                />
              ))}
            </ul>
            {results.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="tinted"
                  onClick={() => void results.fetchNextPage()}
                  disabled={results.isFetchingNextPage}
                >
                  {t("freePhotos.showMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <p
        id={footerId}
        className="shrink-0 px-6 py-3 text-footnote text-label-secondary hairline-top"
      >
        {t("freePhotos.footer")}
      </p>
    </Modal>
  );
}

function FreePhotoResult({
  photo,
  mode,
  folder,
  onAdded,
}: {
  photo: FreePhoto;
  mode: "add" | "choose";
  folder: string | undefined;
  onAdded: (asset: Asset) => void;
}) {
  const thumbnail = useFreePhotoThumbnail(photo.id);
  const add = useMutation({
    mutationFn: () => addFreePhoto(photo.id, folder),
    onSuccess: (asset) => onAdded(asset),
  });
  const title = photo.title || t("freePhotos.untitled");
  const creator = photo.creator || t("freePhotos.unknownCreator");
  const actionLabel =
    mode === "choose" ? t("freePhotos.useNamed", { title }) : t("freePhotos.addNamed", { title });

  // Openverse lists some photos whose files have since gone; they can't be seen or added.
  if (thumbnail.isMissing) return null;

  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <span className="block aspect-[4/3] w-full overflow-hidden rounded-card bg-fill">
        {thumbnail.url && (
          <img src={thumbnail.url} alt="" draggable={false} className="size-full object-cover" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-footnote font-medium text-label">{title}</p>
        <p className="truncate text-caption text-label-secondary">
          {t("freePhotos.byCreator", { creator })}
        </p>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-caption text-label-secondary">
          <span className="truncate">{photo.licenceName}</span>
          {photo.pageUrl && (
            <>
              <span aria-hidden="true">·</span>
              <a
                href={photo.pageUrl}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("freePhotos.sourceOf", { title })}
                className="inline-flex shrink-0 items-center gap-0.5 text-accent hover:underline focus-visible:focus-ring"
              >
                {t("freePhotos.source")}
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </>
          )}
        </p>
        {add.isSuccess ? (
          <span className="flex h-7 shrink-0 items-center gap-1 text-footnote text-label-secondary">
            <Check aria-hidden="true" className="size-4" />
            {t("freePhotos.added")}
          </span>
        ) : (
          <Button
            variant="plain"
            size="small"
            aria-label={actionLabel}
            disabled={add.isPending}
            onClick={() => add.mutate()}
            className="-me-3"
          >
            {add.isPending
              ? t("freePhotos.adding")
              : mode === "choose"
                ? t("freePhotos.use")
                : t("freePhotos.add")}
          </Button>
        )}
      </div>
      <p role="status" className="text-caption text-danger empty:hidden">
        {add.isError
          ? t("freePhotos.addFailed", { title, message: describeFreePhotoError(add.error) })
          : ""}
      </p>
      {add.isSuccess && (
        <p className="sr-only" role="status">
          {t("freePhotos.addedNamed", { title })}
        </p>
      )}
    </li>
  );
}

/** The API explains its own free photo problems (Openverse busy, a photo gone) best. */
function describeFreePhotoError(error: unknown): string {
  if (error instanceof ApiError && error.code.startsWith("FREE_PHOTO")) return error.message;
  return describeError(error);
}
