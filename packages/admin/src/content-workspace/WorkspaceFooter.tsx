import { CalendarClock, ChevronDown, Eye, EyeOff, SquareArrowOutUpRight } from "lucide-react";
import { useState } from "react";
import type { Entry } from "../content/content.types.js";
import type { SaveStatus } from "../content/entryDraft.js";
import { SaveIndicator } from "../content/SaveIndicator.js";
import { ScheduleForm } from "../content/ScheduleForm.js";
import type { ViewPageTarget } from "../content/viewPage.js";
import { ViewPageLink } from "../content/ViewPageLink.js";
import { TreeActionsMenu, type ActionItem } from "../content-tree/TreeActionsMenu.js";
import { Button, buttonClasses } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";

interface WorkspaceFooterProps {
  entry: Entry;
  title: string;
  saveStatus: SaveStatus;
  saveError: string | null;
  hasUnsavedChanges: boolean;
  canSave: boolean;
  canPublish: boolean;
  isWorking: boolean;
  viewPage: ViewPageTarget | undefined;
  isPreviewOpen: boolean;
  previewId: string;
  onTogglePreview: () => void;
  onSave: () => void;
  onSaveAndPublish: () => Promise<void>;
  onSchedule: (publishAt: string) => Promise<void>;
  onUnpublish: () => Promise<void>;
}

/**
 * The bar along the bottom of the workspace, always in reach: how saving is going, Preview
 * and View page, Save, and "Save and publish" with the rarer choices (Schedule…, Unpublish)
 * in its menu.
 */
export function WorkspaceFooter(props: WorkspaceFooterProps) {
  const { entry, canPublish, isWorking } = props;
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const isLive = entry.status === "published";
  const hasNewerEdits = props.hasUnsavedChanges || entry.hasUnpublishedChanges;
  const publishLabel = isLive
    ? t("workspace.saveAndPublishChanges")
    : t("workspace.saveAndPublish");

  const publishOptions: ActionItem[] = [
    {
      key: "schedule",
      label: t("workspace.schedule"),
      icon: CalendarClock,
      onSelect: () => setIsScheduling(true),
    },
    ...(entry.status === "draft"
      ? []
      : [
          {
            key: "unpublish",
            label: t("workspace.unpublish"),
            icon: EyeOff,
            onSelect: () => void props.onUnpublish(),
          },
        ]),
  ];

  return (
    <div
      role="region"
      aria-label={t("workspace.footer")}
      className="sticky bottom-3 z-10 -mx-2 flex items-center gap-2 rounded-panel bg-sidebar px-3 py-2.5 shadow-float hairline-ring backdrop-blur-2xl backdrop-saturate-150 max-md:flex-wrap max-md:justify-end"
    >
      <div className="min-w-0 flex-1">
        <SaveIndicator
          status={props.saveStatus}
          hasUnsavedChanges={props.hasUnsavedChanges}
          errorMessage={props.saveError}
          onRetry={props.onSave}
        />
      </div>
      <Button
        variant="plain"
        icon={<Eye aria-hidden="true" />}
        aria-pressed={props.isPreviewOpen}
        aria-controls={props.isPreviewOpen ? props.previewId : undefined}
        onClick={props.onTogglePreview}
      >
        {props.isPreviewOpen ? t("workspace.closePreview") : t("workspace.preview")}
      </Button>
      {props.viewPage && (
        <ViewPageLink target={props.viewPage} className={buttonClasses("plain", "medium")}>
          <SquareArrowOutUpRight aria-hidden="true" className="size-4" />
          {t("workspace.viewPage")}
        </ViewPageLink>
      )}
      {props.canSave && (
        <Button
          variant={canPublish ? "tinted" : "filled"}
          onClick={props.onSave}
          disabled={isWorking}
        >
          {t("workspace.save")}
        </Button>
      )}
      {canPublish && (
        <div className="flex">
          <Button
            onClick={() => void props.onSaveAndPublish()}
            disabled={isWorking || (isLive && !hasNewerEdits)}
            className="rounded-e-none"
          >
            {isLive && !hasNewerEdits ? t("editor.published") : publishLabel}
          </Button>
          <button
            type="button"
            aria-label={t("workspace.publishOptions")}
            aria-haspopup="menu"
            aria-expanded={menuAt !== null}
            disabled={isWorking}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setMenuAt({ x: box.right - 208, y: box.top - 8 - 44 * publishOptions.length });
            }}
            className={classNames(
              buttonClasses("filled", "medium"),
              "rounded-s-none border-s border-on-accent/25 px-2",
            )}
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
      {menuAt && (
        <TreeActionsMenu
          label={t("workspace.publishOptions")}
          items={publishOptions}
          position={menuAt}
          onClose={() => setMenuAt(null)}
        />
      )}
      <Dialog
        open={isScheduling}
        onClose={() => setIsScheduling(false)}
        title={t("workspace.scheduleTitle", { title: props.title || t("tree.untitled") })}
        description={t("workspace.scheduleDescription")}
      >
        <ScheduleForm
          scheduledFor={entry.scheduledFor}
          isWorking={isWorking}
          onCancel={() => setIsScheduling(false)}
          onSchedule={(publishAt) => {
            setIsScheduling(false);
            void props.onSchedule(publishAt);
          }}
        />
      </Dialog>
    </div>
  );
}
