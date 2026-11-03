import {
  findPath,
  isHiddenOnPage,
  type PageNode,
  rootNodeId,
  siteSectionSlotOf,
  type SiteSectionSlot,
} from "@lintel/builder-model";
import { EyeOff, PanelBottom, PanelTop, X } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ToggleField } from "../panels/content-fields.js";

/**
 * The small controls for the site's navigation and footer (see site-sections/ in the
 * model): the strip above the canvas while one is selected, the page's own switches, the
 * buttons under a section that can become one, and the notes at the foot of the canvas.
 */

/** Which of the site's sections the node is, or is inside; null for the page's own elements. */
export function siteSectionAround(root: PageNode, nodeId: string | null): SiteSectionSlot | null {
  if (!nodeId) return null;
  for (const node of findPath(root, nodeId)) {
    const slot = siteSectionSlotOf(node.id);
    if (slot) return slot;
  }
  return null;
}

const stripButton =
  "flex h-7 items-center gap-1.5 rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring";

/** Above the canvas while the navigation (or something in it) is selected: what it is, and Hide. */
export function SiteSectionStrip({ slot, onHide }: { slot: SiteSectionSlot; onHide: () => void }) {
  const text = useBuilderText();
  const Icon = slot === "navigation" ? PanelTop : PanelBottom;
  return (
    <div className="flex items-center gap-3 hairline-bottom bg-surface px-4 py-1.5">
      <span className="flex min-w-0 items-center gap-1.5 text-footnote text-label-secondary">
        <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="truncate">
          {text("pageBuilder.siteSection.onEveryPage", {
            name: text(`pageBuilder.siteSection.label.${slot}`),
          })}
        </span>
      </span>
      <button type="button" onClick={onHide} className={`ms-auto ${stripButton}`}>
        <EyeOff aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.siteSection.hideHere")}
      </button>
    </div>
  );
}

/**
 * The page's own switches, in the Content tab while nothing is selected: whether this page
 * shows the site's navigation and footer.
 */
export function PageSiteSections({
  page,
  onChange,
}: {
  page: PageNode;
  onChange: (slot: SiteSectionSlot, hidden: boolean) => void;
}) {
  const text = useBuilderText();
  return (
    <section
      aria-labelledby="lintel-page-site-sections"
      className="flex flex-col gap-3 hairline-top px-4 py-4"
    >
      <h3 id="lintel-page-site-sections" className="text-footnote font-semibold text-label">
        {text("pageBuilder.siteSection.page.title")}
      </h3>
      <ToggleField
        label={text("pageBuilder.siteSection.page.showNavigation")}
        value={!isHiddenOnPage(page, "navigation")}
        onChange={(shown) => onChange("navigation", !shown)}
      />
      <ToggleField
        label={text("pageBuilder.siteSection.page.showFooter")}
        value={!isHiddenOnPage(page, "footer")}
        onChange={(shown) => onChange("footer", !shown)}
      />
    </section>
  );
}

/**
 * Under a section at the top level of the page: make it the site's navigation or footer
 * (on every page), or this page's own navigation. Folded away until asked for.
 */
export function SectionSiteTools({
  root,
  node,
  onUseAsSite,
  onUseAsOwn,
}: {
  root: PageNode;
  node: PageNode | null;
  onUseAsSite: (slot: SiteSectionSlot) => void;
  onUseAsOwn: () => void;
}) {
  const text = useBuilderText();
  if (!node || node.type !== "section" || siteSectionSlotOf(node.id) !== null) return null;
  if (!root.children.some((child) => child.id === node.id) || root.id !== rootNodeId) return null;
  const isOwnHeader = node.props.element === "header";
  return (
    <details className="group hairline-top px-4 py-3">
      <summary className="cursor-pointer list-none text-footnote font-medium text-label-secondary hover:text-label focus-visible:focus-ring">
        {text("pageBuilder.siteSection.tools")}
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {(["navigation", "footer"] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onUseAsSite(slot)}
            className="flex h-8 w-full items-center justify-center rounded-control bg-fill px-3 text-footnote font-medium text-accent hover:bg-fill-secondary focus-visible:focus-ring"
          >
            {text(`pageBuilder.siteSection.useAsSite.${slot}`)}
          </button>
        ))}
        {!isOwnHeader && (
          <button
            type="button"
            onClick={onUseAsOwn}
            className="flex h-8 w-full items-center justify-center rounded-control px-3 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
          >
            {text("pageBuilder.siteSection.useAsOwn")}
          </button>
        )}
      </div>
    </details>
  );
}

/** A note at the foot of the canvas: one line, maybe a button, and a way to close it. */
export function SiteSectionNote({
  message,
  action,
  dismissLabel,
  onDismiss,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
  /** The words on the close button when it is a button of its own ("Not now"). */
  dismissLabel?: string;
  onDismiss: () => void;
}) {
  const text = useBuilderText();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-surface px-3 py-2 text-footnote text-label shadow-float hairline-ring"
      >
        <p className="min-w-0 flex-1">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="h-7 rounded-control bg-accent-fill px-2.5 text-footnote font-semibold text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring"
          >
            {action.label}
          </button>
        )}
        {dismissLabel ? (
          <button type="button" onClick={onDismiss} className={stripButton}>
            {dismissLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={text("pageBuilder.siteSection.dismiss")}
            className="-me-1 flex size-6 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
