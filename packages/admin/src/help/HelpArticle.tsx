import { helpScreenshots, type HelpPage } from "@lintel/docs/help";
import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import { renderHelpMarkdown } from "./renderHelpMarkdown.js";
import "./helpArticle.css";

interface HelpArticleProps {
  page: HelpPage;
  /** Scrolled to once the page shows, for links such as "/using/media/#uploading". */
  anchor?: string;
  /** Called for links to another help page, so they open here instead of leaving the admin. */
  onOpenPage: (slug: string, anchor?: string) => void;
  /** The heading level of the title shown above the page. */
  titleLevel?: 1 | 2;
}

/** One docs page, rendered from the Markdown bundled with the admin. */
export function HelpArticle({ page, anchor, onOpenPage, titleLevel = 2 }: HelpArticleProps) {
  const article = useRef<HTMLDivElement>(null);
  const html = useMemo(
    () => renderHelpMarkdown(page.markdown, { screenshots: helpScreenshots, titleLevel }),
    [page.markdown, titleLevel],
  );

  useEffect(() => {
    if (!anchor) return;
    const target = article.current?.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`);
    target?.scrollIntoView?.({ block: "start" });
  }, [anchor, html]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>("a[data-help-slug]");
    // Modified clicks (new tab, new window) go to the full docs as the link says.
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onOpenPage(link.dataset.helpSlug ?? "", link.dataset.helpAnchor || undefined);
  }

  return (
    // The click handler only catches clicks on the links inside. Links fire click on Enter
    // too, so keyboard users get the same behaviour without a key handler here.
    <div
      ref={article}
      className="help-article"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
