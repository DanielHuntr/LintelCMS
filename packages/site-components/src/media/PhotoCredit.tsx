import type { ReactNode } from "react";
import type { PhotoCredit } from "../site.types.js";

/**
 * The words of a photo credit: "Photo: Ian Sane, CC BY 2.0", with the creator linking to
 * where the photo was found and the licence to its terms. A credit typed by hand has no
 * parts and is shown as typed.
 */
export function PhotoCreditText({ credit }: { credit: PhotoCredit }): ReactNode {
  if (!credit.licenceName) return credit.text;
  const creator = credit.creator ? (
    <>
      {credit.sourceUrl ? (
        <a href={credit.sourceUrl} rel="noopener">
          {credit.creator}
        </a>
      ) : (
        credit.creator
      )}
      {", "}
    </>
  ) : null;
  const licence = credit.licenceUrl ? (
    <a href={credit.licenceUrl} rel="license noopener">
      {credit.licenceName}
    </a>
  ) : (
    credit.licenceName
  );
  return (
    <>
      {"Photo: "}
      {creator}
      {licence}
    </>
  );
}

/**
 * A figure's caption with the photo's credit: `<figcaption class="lintel-credit">` alone, or
 * after the caption when there is one (a figure has one figcaption). Nothing when neither.
 */
export function FigureCaption({
  caption,
  credit,
  className,
  captionProps,
}: {
  caption: ReactNode;
  credit: PhotoCredit | null | undefined;
  /** The caption's own class, such as "lintel-figure__caption". */
  className?: string;
  /** Extra attributes for the caption text, such as the builder's field marker. */
  captionProps?: Record<string, string>;
}) {
  if (!caption && !credit) return null;
  if (!caption && credit) {
    return (
      <figcaption className="lintel-credit">
        <PhotoCreditText credit={credit} />
      </figcaption>
    );
  }
  if (!credit) {
    return (
      <figcaption className={className} {...captionProps}>
        {caption}
      </figcaption>
    );
  }
  return (
    <figcaption className={className}>
      <span {...captionProps}>{caption}</span>
      <span className="lintel-credit">
        <PhotoCreditText credit={credit} />
      </span>
    </figcaption>
  );
}
