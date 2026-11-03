import {
  Copy,
  Ellipsis,
  Eye,
  Globe,
  Info,
  PanelRight,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { Menu, type MenuItem } from "../design/Menu.js";
import { t } from "../i18n/strings.js";
import type { ViewPageTarget } from "./viewPage.js";
import { ViewPageLink } from "./ViewPageLink.js";

interface EntryEditorBarProps {
  /** Where the entry is: its section and the pages above it. */
  breadcrumbs: ReactNode;
  saveIndicator: ReactNode;
  /** The main action: Publish, or Save for people who can't publish. */
  primaryAction: ReactNode;
  isPanelOpen: boolean;
  panelId: string;
  onTogglePanel: () => void;
  /** Undefined leaves Delete out of the "More" menu (nothing to delete yet, or not allowed). */
  onDelete: (() => void) | undefined;
  /** Undefined leaves "Duplicate entry" out (nothing saved yet, or not allowed). */
  onDuplicate: (() => void) | undefined;
  /** Undefined leaves "Copy to site" out (one site only, a shared collection, or not allowed). */
  onCopyToSite?: () => void;
  /** Undefined leaves "Details" out (nothing saved yet). */
  onShowDetails?: () => void;
  isPreviewOpen: boolean;
  previewId: string;
  onTogglePreview: () => void;
  /** Where "View page" goes; undefined while nothing is live. */
  viewPage: ViewPageTarget | undefined;
}

/**
 * The editor's toolbar. It stays at the top while you scroll, so saving state and
 * Publish are always in reach, and it blurs the page beneath it like a macOS title bar.
 */
export function EntryEditorBar({
  breadcrumbs,
  saveIndicator,
  primaryAction,
  isPanelOpen,
  panelId,
  onTogglePanel,
  onDelete,
  onDuplicate,
  onCopyToSite,
  onShowDetails,
  isPreviewOpen,
  previewId,
  onTogglePreview,
  viewPage,
}: EntryEditorBarProps) {
  const moreItems: MenuItem[] = [
    {
      label: isPreviewOpen ? t("editor.hidePreview") : t("editor.preview"),
      icon: Eye,
      onSelect: onTogglePreview,
    },
    ...(onShowDetails ? [{ label: t("editor.details"), icon: Info, onSelect: onShowDetails }] : []),
    ...(onDuplicate ? [{ label: t("editor.duplicate"), icon: Copy, onSelect: onDuplicate }] : []),
    ...(onCopyToSite
      ? [{ label: t("sites.copy.action"), icon: Globe, onSelect: onCopyToSite }]
      : []),
    ...(onDelete
      ? [{ label: t("editor.delete"), icon: Trash2, tone: "danger" as const, onSelect: onDelete }]
      : []),
  ];

  return (
    <div className="sticky top-0 z-20 -mt-14 -me-16 -ml-(--page-gutter) mb-8 flex h-16 items-center gap-3 bg-background/80 pt-2 pe-16 pl-(--page-gutter) backdrop-blur-xl backdrop-saturate-150">
      {breadcrumbs}

      <div className="ms-auto flex shrink-0 items-center gap-1.5">
        <div className="me-2 max-sm:me-0">{saveIndicator}</div>
        {viewPage && (
          <ViewPageLink
            target={viewPage}
            className="flex h-9 items-center gap-1.5 rounded-control px-2.5 text-body text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
          >
            <SquareArrowOutUpRight aria-hidden="true" strokeWidth={1.75} className="size-[17px]" />
            {/* Icons only on a phone, so Publish stays in view; the words stay for screen readers. */}
            <span className="max-sm:sr-only">{t("editor.viewPage")}</span>
          </ViewPageLink>
        )}
        <button
          type="button"
          onClick={onTogglePreview}
          aria-expanded={isPreviewOpen}
          aria-controls={previewId}
          className={classNames(
            "flex h-9 items-center gap-1.5 rounded-control px-2.5 text-body transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring",
            isPreviewOpen ? "text-accent" : "text-label-secondary",
          )}
        >
          <Eye aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
          <span className="max-sm:sr-only">{t("editor.preview")}</span>
        </button>
        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={isPanelOpen}
          aria-controls={panelId}
          aria-label={t("editor.togglePanel")}
          title={t("editor.togglePanel")}
          className={classNames(
            "flex size-9 items-center justify-center rounded-control transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring",
            isPanelOpen ? "text-accent" : "text-label-secondary",
          )}
        >
          <PanelRight aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
        </button>
        <Menu
          label={t("editor.more")}
          trigger={<Ellipsis aria-hidden="true" strokeWidth={2} className="size-[18px]" />}
          items={moreItems}
        />
        <div className="ms-1.5">{primaryAction}</div>
      </div>
    </div>
  );
}
