import { File, Image, RotateCcw } from "lucide-react";
import { formatRelativeTime } from "../content/relativeTime.js";
import { Button } from "../design/Button.js";
import { GroupedList } from "../design/GroupedList.js";
import { t } from "../i18n/strings.js";
import type { BinnedAsset } from "../media/media.api.js";
import { formatFileSize } from "../media/formatting.js";

interface RecycleBinFilesProps {
  files: readonly BinnedAsset[];
  now: number;
  canRestore: boolean;
  canDelete: boolean;
  isWorking: boolean;
  onRestore: (file: BinnedAsset) => void;
  onDelete: (file: BinnedAsset) => void;
}

/** The recycle bin's Files group: files deleted from the media library, newest first. */
export function RecycleBinFiles({
  files,
  now,
  canRestore,
  canDelete,
  isWorking,
  onRestore,
  onDelete,
}: RecycleBinFilesProps) {
  return (
    <GroupedList header={t("recycleBin.files")}>
      {files.map((file) => {
        const Icon = file.mimeType.startsWith("image/") ? Image : File;
        const values = {
          time: formatRelativeTime(file.deletedAt, now),
          person: file.deletedBy?.name ?? "",
        };
        return (
          <li
            key={file.id}
            className="flex items-center gap-3 px-4 py-3 hairline-top first:border-t-0"
          >
            <Icon
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-5 shrink-0 text-label-secondary"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body text-label">{file.filename}</p>
              <p className="text-footnote text-label-secondary">
                {file.deletedBy
                  ? t("recycleBin.fileDetail", values)
                  : t("recycleBin.fileDetailNobody", values)}
                {` · ${formatFileSize(file.size)}`}
              </p>
            </div>
            {canRestore && (
              <Button
                variant="tinted"
                size="small"
                icon={<RotateCcw aria-hidden="true" />}
                aria-label={t("recycleBin.restoreLabel", { title: file.filename })}
                disabled={isWorking}
                onClick={() => onRestore(file)}
              >
                {t("recycleBin.restore")}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="plain"
                size="small"
                aria-label={t("recycleBin.deleteForeverLabel", { title: file.filename })}
                disabled={isWorking}
                onClick={() => onDelete(file)}
              >
                {t("recycleBin.deleteForever")}
              </Button>
            )}
          </li>
        );
      })}
    </GroupedList>
  );
}
