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
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { deleteFromRecycleBin, emptyRecycleBin, restoreFromRecycleBin } from "./contentTree.api.js";
import type { RecycleBinItem } from "./contentTree.types.js";
import { useRecycleBin, useRefreshContent } from "./contentTree.queries.js";
import { iconForContent } from "./typeIcons.js";

type Confirming = { kind: "one"; item: RecycleBinItem } | { kind: "all" } | null;

/**
 * /content/recycle-bin: what was deleted from the tree, newest first. Restore puts an item
 * back (under its old parent when that is still there) as a draft; deleting for good, or
 * emptying the bin, asks first.
 */
export function RecycleBinPage() {
  const bin = useRecycleBin();
  const navigate = useNavigate();
  const refresh = useRefreshContent();
  const now = useNow();
  const canRestore = useCan("entries:create");
  const canDelete = useCan("entries:delete");
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const items = bin.data?.items ?? [];

  async function restore(item: RecycleBinItem) {
    setWorkingId(item.id);
    try {
      const restored = await restoreFromRecycleBin(item.id);
      await refresh([restored.entryId]);
      setMessage({ text: t("recycleBin.restored", { title: item.title }), isError: false });
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
    setWorkingId(confirming.kind === "one" ? confirming.item.id : "all");
    try {
      if (confirming.kind === "one") await deleteFromRecycleBin(confirming.item.id);
      else {
        await emptyRecycleBin();
        setMessage({ text: t("recycleBin.emptied"), isError: false });
      }
      await refresh();
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
          canDelete && items.length > 0 ? (
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
      {bin.data && items.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Trash2}
            title={t("recycleBin.empty")}
            description={t("recycleBin.emptyDescription")}
          />
        </div>
      )}
      {items.length > 0 && (
        <ul className="overflow-hidden rounded-card bg-surface">
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
        </ul>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={
          confirming?.kind === "one"
            ? t("recycleBin.deleteForeverTitle", { title: confirming.item.title })
            : t("recycleBin.emptyBinTitle")
        }
        message={
          confirming?.kind === "one"
            ? t("recycleBin.deleteForeverMessage")
            : t("recycleBin.emptyBinMessage", { count: items.length })
        }
        confirmLabel={
          confirming?.kind === "one" ? t("recycleBin.deleteForever") : t("recycleBin.emptyBin")
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
