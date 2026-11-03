import { Copy, Ellipsis, Eye, Globe, Info, PanelRight, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { Menu, type MenuItem } from "../design/Menu.js";
import { t } from "../i18n/strings.js";
import { PagePreviewButton, PageViewLink } from "../page-home/PageBarParts.js";
import type { ViewPageTarget } from "./viewPage.js";

interface EntryEditorBarProps {
  /** The page's name, after its section and the pages above it. */
  breadcrumbs: ReactNode;
  /** Where the page stands, in words, under its name. */
  status?: ReactNode;
  /** Design, Content and Items, when there's room for them here. */
  viewSwitch?: ReactNode;
  /** Little room: the buttons are icons, and the name stands alone. See useBarRoom. */
  isTight?: boolean;
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
 * The page's top bar, which the designer's matches (see src/page-home). It stays at the top
 * while you scroll, so saving state and Publish are always in reach, and it blurs the page
 * beneath it like a macOS title bar.
 */
export function EntryEditorBar({
  breadcrumbs,
  status,
  viewSwitch,
  isTight = false,
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
    // Below md the bar also covers the strip with the fixed menu and help buttons, and sits
    // under them (z-10), so scrolled content never shows through and the buttons stay usable.
    <div
      data-tight={isTight ? "" : undefined}
      className="group/bar sticky top-0 z-20 -mt-14 -me-(--page-gutter) -ml-(--page-gutter) mb-8 flex h-16 items-center gap-3 bg-background/80 pt-2 pe-(--page-gutter) pl-(--page-gutter) backdrop-blur-xl backdrop-saturate-150 max-md:z-10 max-md:-mt-26 max-md:h-28 max-md:pt-14 md:-me-16 md:pe-16"
    >
      {/* On a phone the name sits between the fixed menu and help buttons, like an iOS title. */}
      <div className="flex min-w-24 flex-1 flex-col gap-px max-md:absolute max-md:inset-x-16 max-md:top-3 max-md:h-11 max-md:items-center max-md:justify-center">
        {breadcrumbs}
        {status}
      </div>

      {viewSwitch && <div className="shrink-0">{viewSwitch}</div>}

      {/* Below 400px wide the buttons sit closer, so the bar fits a 320px screen (LINTEL-A11Y-003). */}
      <div className="ms-auto flex shrink-0 items-center gap-1 max-[25rem]:gap-0">
        <div className="me-1.5 max-sm:me-0">{saveIndicator}</div>
        {viewPage && <PageViewLink target={viewPage} />}
        <PagePreviewButton
          onClick={onTogglePreview}
          expanded={{ isOpen: isPreviewOpen, controls: previewId }}
        />
        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={isPanelOpen}
          aria-controls={panelId}
          aria-label={t("editor.togglePanel")}
          title={t("editor.togglePanel")}
          className={classNames(
            "flex size-8 items-center justify-center rounded-control transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring",
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
