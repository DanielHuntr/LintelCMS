import { t } from "../i18n/strings.js";

/** The ways of looking at one page. "children" is the list under it (a Blog page's posts). */
export type PageView = "design" | "content" | "children";

interface PageViewFacts {
  /** Its blueprint has a design, and it has been saved, so the designer can open it. */
  canOpenDesign: boolean;
  /** The designer needs a laptop's width; on a phone it only says so. */
  isNarrowScreen: boolean;
  listsChildren: boolean;
}

/** Which views a page offers, in the switch's order. */
export function pageViews(facts: PageViewFacts): PageView[] {
  return [
    ...(facts.canOpenDesign && !facts.isNarrowScreen ? (["design"] as const) : []),
    "content",
    ...(facts.listsChildren ? (["children"] as const) : []),
  ];
}

/** What the main button says, the same in both views. */
export type PublishState =
  | "notLive"
  | "hasChanges"
  | "upToDate"
  | "publishing"
  /** A few seconds after Publish worked, so the button can say so. */
  | "justPublished";

interface PublishFacts {
  isLive: boolean;
  /** Saved or unsaved changes the website doesn't show yet, the page's own or shared ones. */
  hasNewerChanges: boolean;
  isPublishing?: boolean;
  justPublished?: boolean;
}

export function publishState(facts: PublishFacts): PublishState {
  if (facts.isPublishing) return "publishing";
  if (facts.justPublished) return "justPublished";
  if (!facts.isLive) return "notLive";
  return facts.hasNewerChanges ? "hasChanges" : "upToDate";
}

export function publishWords(state: PublishState): string {
  switch (state) {
    case "notLive":
      return t("editor.publish");
    case "hasChanges":
      return t("editor.publishChanges");
    case "publishing":
      return t("pageDesign.publishing");
    case "justPublished":
    case "upToDate":
      return t("editor.published");
  }
}
