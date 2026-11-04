import { Box, ImagePlus, Images, Search, Upload, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { AssetGrid, AssetGridPlaceholder } from "./AssetGrid.js";
import { DropOverlay } from "./DropOverlay.js";
import { useAssetList, useRefreshAssetLists } from "./media.queries.js";
import { Modal } from "./Modal.js";
import { UploadProgressList } from "./UploadProgressList.js";
import { acceptedImageTypes, acceptedModelTypes } from "./upload-rules.js";
import { useDebouncedValue } from "./useDebouncedValue.js";
import { FreePhotosDialog } from "../free-photos/FreePhotosDialog.js";
import { useCanAddFreePhotos } from "../free-photos/useFreePhotos.js";
import { useFileDrop } from "./useFileDrop.js";
import { usePasteFiles } from "./usePasteFiles.js";
import { useUploadQueue } from "./useUploadQueue.js";

interface MediaPickerDialogProps {
  /** The field being filled, shown under the title so people know what they're choosing for. */
  fieldLabel: string;
  currentAssetId: string | null;
  onChoose: (assetId: string) => void;
  onClose: () => void;
  /** What to choose: a picture (the default), a 3D model, or a Lottie or Rive animation. */
  kind?: "picture" | "model" | "animation";
  /** For an animation, the file types the element plays: [".json", ".lottie"]. */
  accept?: readonly string[];
}

/**
 * The library's images (or 3D models) in a dialog. Click or press Enter on one to choose it;
 * upload a new one (button or drop) and it's chosen as soon as it arrives.
 */
export function MediaPickerDialog({
  fieldLabel,
  currentAssetId,
  onChoose,
  onClose,
  kind = "picture",
  accept = [],
}: MediaPickerDialogProps) {
  const isModel = kind === "model";
  const isAnimation = kind === "animation";
  const extensions = useMemo(
    () => accept.map((extension) => extension.replace(".", "").toLowerCase()),
    [accept],
  );
  const titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const dropArea = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [isFindingFreePhotos, setIsFindingFreePhotos] = useState(false);
  const canAddFreePhotos = useCanAddFreePhotos() && kind === "picture";
  const debouncedSearch = useDebouncedValue(search, 250);
  const images = useAssetList(
    debouncedSearch,
    isAnimation ? "animation" : isModel ? "model" : "image",
  );
  const refreshLists = useRefreshAssetLists();
  const uploads = useUploadQueue({
    imagesOnly: kind === "picture",
    modelsOnly: isModel,
    ...(isAnimation && { extensions }),
    onUploaded: (asset) => {
      void refreshLists();
      onChoose(asset.id);
    },
  });
  const isDraggingFiles = useFileDrop(uploads.addFiles, { target: dropArea });
  usePasteFiles(uploads.addFiles, { enabled: !isFindingFreePhotos });
  const assets = (images.data?.pages.flatMap((page) => page.assets) ?? []).filter(
    (asset) =>
      !isAnimation || extensions.includes(asset.filename.split(".").pop()?.toLowerCase() ?? ""),
  );
  const words = isAnimation ? "animation" : isModel ? "model" : null;
  const visibleUploads = uploads.items.filter((item) => item.status !== "done");

  return (
    <Modal size="dialog" labelledBy={titleId} onClose={onClose}>
      <div ref={dropArea} className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-title text-label">
              {t(words ? `media.picker.${words}.dialogTitle` : "media.picker.dialogTitle")}
            </h2>
            <p className="truncate text-footnote text-label-secondary">{fieldLabel}</p>
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

        <div className="flex shrink-0 items-end gap-3 px-6 pb-4">
          <div className="relative flex-1">
            <TextField
              data-autofocus
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
          {canAddFreePhotos && (
            <Button
              variant="tinted"
              icon={<Images aria-hidden="true" />}
              onClick={() => setIsFindingFreePhotos(true)}
              className="h-10"
            >
              {t("freePhotos.open")}
            </Button>
          )}
          <Button
            variant="tinted"
            icon={<Upload aria-hidden="true" />}
            onClick={() => fileInput.current?.click()}
            className="h-10"
          >
            {t("media.picker.upload")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={
              isAnimation ? accept.join(",") : isModel ? acceptedModelTypes : acceptedImageTypes
            }
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              uploads.addFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
        </div>

        {visibleUploads.length > 0 && (
          <div className="mx-6 mb-4 rounded-card bg-fill/60 px-4 py-1" aria-live="polite">
            <UploadProgressList items={visibleUploads} onDismiss={uploads.dismiss} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 pb-6">
          {images.isPending ? (
            <AssetGridPlaceholder label={t("media.loading")} />
          ) : assets.length === 0 ? (
            <EmptyState
              size="page"
              icon={debouncedSearch.trim() ? Search : words ? Box : ImagePlus}
              title={
                debouncedSearch.trim()
                  ? t("media.noResults.title")
                  : t(words ? `media.picker.${words}.empty.title` : "media.picker.empty.title")
              }
              description={
                debouncedSearch.trim()
                  ? t("media.noResults.description", { search: debouncedSearch.trim() })
                  : t(
                      words
                        ? `media.picker.${words}.empty.description`
                        : "media.picker.empty.description",
                    )
              }
            />
          ) : (
            <>
              <AssetGrid
                assets={assets}
                label={t(words ? `media.picker.${words}.gridLabel` : "media.picker.gridLabel")}
                currentAssetId={currentAssetId}
                onActivate={(asset) => onChoose(asset.id)}
              />
              {images.hasNextPage && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="tinted"
                    onClick={() => void images.fetchNextPage()}
                    disabled={images.isFetchingNextPage}
                  >
                    {t("media.showMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <DropOverlay visible={isDraggingFiles} contained />
      </div>
      {isFindingFreePhotos && (
        <FreePhotosDialog
          mode="choose"
          fieldLabel={fieldLabel}
          onAdded={(asset) => {
            void refreshLists();
            onChoose(asset.id);
          }}
          onClose={() => setIsFindingFreePhotos(false)}
        />
      )}
    </Modal>
  );
}
