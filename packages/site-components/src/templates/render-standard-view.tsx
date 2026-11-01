import type { PostCardLayout } from "../posts/PostCard.js";
import { MessageLayout } from "./MessageLayout.js";
import { PageLayout } from "./PageLayout.js";
import { PostLayout } from "./PostLayout.js";
import { PostListLayout } from "./PostListLayout.js";
import type { TemplateViewProps } from "./site-template.js";

/**
 * Draws a page with the shared layouts. Both built-in templates use this, choosing only
 * how lists of posts look; a custom template can use it too and replace one kind of page.
 */
export function renderStandardView(
  { view, chrome, labels }: TemplateViewProps,
  options: { cardLayout: PostCardLayout },
) {
  switch (view.kind) {
    case "page":
      return <PageLayout view={view} />;
    case "post":
      return <PostLayout view={view} locale={chrome.locale} labels={labels} />;
    case "postList":
      return (
        <PostListLayout
          view={view}
          locale={chrome.locale}
          labels={labels}
          cardLayout={options.cardLayout}
        />
      );
    case "notFound":
    case "emptySite":
      return <MessageLayout view={view} labels={labels} homeUrl={chrome.homeUrl} />;
  }
}
