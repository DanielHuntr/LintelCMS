import { useId } from "react";
import { t } from "../i18n/strings.js";

interface SearchPreviewProps {
  title: string;
  /** The page's full address, or its path when the site's address isn't set. */
  url: string;
  description: string;
}

/** About where a search results page cuts text off, in characters. */
const SHOWN_TITLE_CHARACTERS = 60;
const SHOWN_DESCRIPTION_CHARACTERS = 160;

/**
 * Roughly how the page will look in a search results list: the address as a breadcrumb,
 * the title as a blue link and the description under it, each cut where search engines
 * usually cut them. Colours come from the design tokens like everything else, so it
 * follows light and dark mode. It is a picture, so screen readers get one sentence instead.
 */
export function SearchPreview({ title, url, description }: SearchPreviewProps) {
  const captionId = useId();
  const shownTitle = shorten(title || t("seo.preview.untitled"), SHOWN_TITLE_CHARACTERS);
  const shownDescription = shorten(
    description || t("seo.preview.noDescription"),
    SHOWN_DESCRIPTION_CHARACTERS,
  );

  return (
    <figure aria-labelledby={captionId} className="flex flex-col gap-1.5">
      <figcaption id={captionId} className="text-caption font-medium text-label-secondary">
        {t("seo.preview.caption")}
      </figcaption>
      <div
        aria-hidden="true"
        className="flex flex-col gap-0.5 rounded-control bg-background p-3 font-[Arial,sans-serif]"
      >
        <span className="truncate text-[12px] leading-4 text-label-secondary">
          {breadcrumb(url)}
        </span>
        <span className="text-[16px] leading-5 text-accent">{shownTitle}</span>
        <span className="text-[13px] leading-[18px] text-label-secondary">{shownDescription}</span>
      </div>
      <p className="sr-only">
        {t("seo.preview.spoken", { title: shownTitle, description: shownDescription })}
      </p>
    </figure>
  );
}

function shorten(text: string, characters: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= characters) return trimmed;
  const cut = trimmed.slice(0, characters);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > characters * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()} …`;
}

/** "https://example.com/blog/hello" reads as "example.com › blog › hello", as in results. */
export function breadcrumb(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter((part) => part !== "");
    return [parsed.host, ...parts].join(" › ");
  } catch {
    return (
      url
        .split("/")
        .filter((part) => part !== "")
        .join(" › ") || "/"
    );
  }
}
