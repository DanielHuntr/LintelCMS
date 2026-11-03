import { Eye, SquareArrowOutUpRight } from "lucide-react";
import type { ViewPageTarget } from "../content/viewPage.js";
import { ViewPageLink } from "../content/ViewPageLink.js";
import { classNames } from "../design/classNames.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { publishWords, type PageView, type PublishState } from "./pageViews.js";

/**
 * The parts both of a page's views share in their top bar, so the page screen and the designer
 * read as one place: the same switch, the same words, the same buttons at the same size.
 */

/**
 * The words go on a phone, in a small window, and in a page bar marked tight (see useBarRoom);
 * screen readers keep them.
 */
const wordsWhenRoomy = "max-xl:sr-only group-data-tight/bar:sr-only";

const barButton =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2 text-footnote font-medium whitespace-nowrap transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring max-[25rem]:px-1.5";

export function PageViewLink({ target }: { target: ViewPageTarget }) {
  return (
    <ViewPageLink
      target={target}
      label={t("editor.viewPage")}
      className={classNames(barButton, "text-label-secondary")}
    >
      <SquareArrowOutUpRight aria-hidden="true" strokeWidth={1.75} className="size-4" />
      <span className={wordsWhenRoomy}>{t("editor.viewPage")}</span>
    </ViewPageLink>
  );
}

interface PagePreviewButtonProps {
  onClick: () => void;
  /** For the preview beside the fields, which this shows and hides. */
  expanded?: { isOpen: boolean; controls: string };
}

export function PagePreviewButton({ onClick, expanded }: PagePreviewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded?.isOpen}
      aria-controls={expanded?.controls}
      title={t("editor.preview")}
      className={classNames(barButton, expanded?.isOpen ? "text-accent" : "text-label-secondary")}
    >
      <Eye aria-hidden="true" strokeWidth={1.75} className="size-4" />
      <span className={wordsWhenRoomy}>{t("editor.preview")}</span>
    </button>
  );
}

interface PagePublishButtonProps {
  state: PublishState;
  disabled?: boolean;
  onPublish: () => void;
}

/**
 * The one main action. With nothing to publish there's no greyed-out button to puzzle over,
 * just the word, kept as wide as the button so the bar doesn't jump at the first edit.
 */
export function PagePublishButton({ state, disabled = false, onPublish }: PagePublishButtonProps) {
  if (state === "upToDate") {
    return (
      <span className="inline-flex h-8 min-w-30 shrink-0 items-center justify-center px-3 text-footnote font-medium text-label-secondary max-[25rem]:min-w-0">
        {publishWords(state)}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onPublish}
      disabled={disabled || state === "publishing" || state === "justPublished"}
      className="h-8 min-w-30 shrink-0 rounded-control bg-accent-fill px-3 text-footnote font-semibold whitespace-nowrap text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring disabled:opacity-50 max-[25rem]:min-w-0"
    >
      {publishWords(state)}
    </button>
  );
}

interface PageViewSwitchProps {
  pageTitle: string;
  views: readonly PageView[];
  view: PageView;
  /** People who can't design change the page's words in place, so "Design" would be wrong. */
  canDesign: boolean;
  onChange: (view: PageView) => void;
  /** Called when someone is about to choose: pointing at it, or tabbing to it. */
  onApproach?: () => void;
}

/** Design, Content and (for a page with a list under it) Items: views of the same page. */
export function PageViewSwitch({
  pageTitle,
  views,
  view,
  canDesign,
  onChange,
  onApproach,
}: PageViewSwitchProps) {
  if (views.length < 2) return null;
  const labels: Record<PageView, string> = {
    design: canDesign ? t("pageHome.view.design") : t("pageHome.view.onThePage"),
    content: t("workspace.tab.content"),
    children: t("workspace.tab.children"),
  };
  return (
    <div data-tour="page-views" onPointerEnter={onApproach} onFocus={onApproach}>
      <SegmentedControl
        label={t("workspace.tabs", { title: pageTitle })}
        options={views.map((value) => ({ value, label: labels[value] }))}
        value={view}
        onChange={onChange}
      />
    </div>
  );
}
