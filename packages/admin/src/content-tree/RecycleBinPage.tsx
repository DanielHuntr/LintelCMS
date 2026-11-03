import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { deleteFromRecycleBin, emptyRecycleBin, restoreFromRecycleBin } from "./contentTree.api.js";
import type { RecycleBinItem } from "./contentTree.types.js";
import { useRecycleBin, useRefreshContent } from "./contentTree.queries.js";
import { useContentTree } from "./ContentTreeContext.js";
import { iconForContent } from "./typeIcons.js";
import {
  type BinnedAsset,
  deleteAssetForGood,
  emptyMediaBin,
  restoreAsset,
} from "../media/media.api.js";
import { useMediaBin, useRefreshMediaBin } from "../media/media.queries.js";
import { RecycleBinFiles } from "./RecycleBinFiles.js";

type Confirming =
  | { kind: "one"; item: RecycleBinItem }
  | { kind: "file"; file: BinnedAsset }
  | { kind: "all" }
  | null;

/**
 * /content/recycle-bin: what was deleted, newest first: pages and entries, then files from
 * the media library. Restore puts an entry back (under its old parent when that is still
 * there) as a draft, and a file back in the library; deleting for good, or emptying the
 * bin, asks first.
 */
export function RecycleBinPage() {
  const bin = useRecycleBin();
  const navigate = useNavigate();
  const refresh = useRefreshContent();
  const tree = useContentTree();
  const now = useNow();
  const canRestore = useCan("entries:create");
  const canDelete = useCan("entries:delete");
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const items = bin.data?.items ?? [];
  const canSeeFiles = useCan("media:read");
  const canRestoreFiles = useCan("media:upload");
  const canDeleteFiles = useCan("media:delete");
  const mediaBin = useMediaBin(canSeeFiles);
  const refreshFiles = useRefreshMediaBin();
  const files = mediaBin.data?.items ?? [];
  const emptiesContent = canDelete && items.length > 0;
  const emptiesFiles = canDeleteFiles && files.length > 0;
  const isEmpty = bin.data !== undefined && items.length === 0 && files.length === 0;

  async function restoreFile(file: BinnedAsset) {
    setWorkingId(file.id);
    try {
      await restoreAsset(file.id);
      await refreshFiles();
      setMessage({ text: t("recycleBin.restoredFile", { name: file.filename }), isError: false });
    } catch (error) {
      setMessage({ text: describeError(error), isError: true });
    } finally {
      setWorkingId(null);
    }
  }

  async function restore(item: RecycleBinItem) {
    setWorkingId(item.id);
    try {
      const restored = await restoreFromRecycleBin(item.id);
      await refresh([restored.entryId]);
      // Restoring opens the page, so the note goes at the foot of the tree, where it stays in
      // sight, and replaces the "moved to the recycle bin" note that led here.
      tree.notify({ tone: "neutral", message: t("recycleBin.restored", { title: item.title }) });
      await navigate({
        to: "/content/$collection/$entryId",
        params: { collection: item.collection.handle, entryId: restored.entryId },
      });
    } catch (error) {
      setMessage({ text: describeError(error), isError: true });
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmDelete() {
    if (!confirming) return;
    setWorkingId(
      confirming.kind === "one"
        ? confirming.item.id
        : confirming.kind === "file"
          ? confirming.file.id
          : "all",
    );
    try {
      if (confirming.kind === "one") await deleteFromRecycleBin(confirming.item.id);
      else if (confirming.kind === "file") await deleteAssetForGood(confirming.file.id);
      else {
        if (emptiesContent) await emptyRecycleBin();
        if (emptiesFiles) await emptyMediaBin();
        setMessage({ text: t("recycleBin.emptied"), isError: false });
      }
      await Promise.all([refresh(), refreshFiles()]);
      setConfirming(null);
    } catch (error) {
      setMessage({ text: describeError(error), isError: true });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <Page width="readable">
      <LargeTitle
        title={t("recycleBin.title")}
        subtitle={t("recycleBin.subtitle")}
        actions={
          emptiesContent || emptiesFiles ? (
            <Button variant="destructive" onClick={() => setConfirming({ kind: "all" })}>
              {t("recycleBin.emptyBin")}
            </Button>
          ) : undefined
        }
      />
      <p
        role="status"
        className={
          message?.isError
            ? "mb-4 text-footnote text-danger"
            : "mb-4 text-footnote text-label-secondary"
        }
      >
        {message?.text}
      </p>

      {bin.isError && <LoadError error={bin.error} onRetry={() => void bin.refetch()} />}
      {bin.isPending && (
        <LoadingRegion label={t("recycleBin.loading")}>
          <Skeleton className="h-40 w-full rounded-card" />
        </LoadingRegion>
      )}
      {isEmpty && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Trash2}
            title={t("recycleBin.empty")}
            description={t("recycleBin.emptyDescription")}
          />
        </div>
      )}
      <div className="flex flex-col gap-7">
        {items.length > 0 && (
          <GroupedList header={files.length > 0 ? t("recycleBin.content") : undefined}>
            {items.map((item) => {
              const Icon = iconForContent(item.collection);
              const values = {
                collection: item.collection.name,
                time: formatRelativeTime(item.deletedAt, now),
                person: item.deletedBy?.name ?? "",
              };
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 hairline-top first:border-t-0"
                >
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-5 shrink-0 text-label-secondary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-label">
                      {item.title || t("tree.untitled")}
                    </p>
                    <p className="text-footnote text-label-secondary">
                      {item.deletedBy
                        ? t("recycleBin.detail", values)
                        : t("recycleBin.detailNobody", values)}
                      {item.itemCount > 1 &&
                        ` · ${t("recycleBin.withChildren", { count: item.itemCount - 1 })}`}
                    </p>
                  </div>
                  {canRestore && (
                    <Button
                      variant="tinted"
                      size="small"
                      icon={<RotateCcw aria-hidden="true" />}
                      aria-label={t("recycleBin.restoreLabel", { title: item.title })}
                      disabled={workingId !== null}
                      onClick={() => void restore(item)}
                    >
                      {t("recycleBin.restore")}
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="plain"
                      size="small"
                      aria-label={t("recycleBin.deleteForeverLabel", { title: item.title })}
                      disabled={workingId !== null}
                      onClick={() => setConfirming({ kind: "one", item })}
                    >
                      {t("recycleBin.deleteForever")}
                    </Button>
                  )}
                </li>
              );
            })}
          </GroupedList>
        )}
        {files.length > 0 && (
          <RecycleBinFiles
            files={files}
            now={now}
            canRestore={canRestoreFiles}
            canDelete={canDeleteFiles}
            isWorking={workingId !== null}
            onRestore={(file) => void restoreFile(file)}
            onDelete={(file) => setConfirming({ kind: "file", file })}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={
          confirming?.kind === "one"
            ? t("recycleBin.deleteForeverTitle", { title: confirming.item.title })
            : confirming?.kind === "file"
              ? t("recycleBin.deleteForeverTitle", { title: confirming.file.filename })
              : t("recycleBin.emptyBinTitle")
        }
        message={
          confirming?.kind === "all"
            ? t("recycleBin.emptyBinMessage", {
                count: (emptiesContent ? items.length : 0) + (emptiesFiles ? files.length : 0),
              })
            : t("recycleBin.deleteForeverMessage")
        }
        confirmLabel={
          confirming?.kind === "all" ? t("recycleBin.emptyBin") : t("recycleBin.deleteForever")
        }
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={workingId !== null}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Page>
  );
}
