import { classNames } from "../class-names.js";
import type { SiteLink } from "../site.types.js";

export interface ButtonProps {
  link: SiteLink;
  /** Primary is filled with the brand colour; secondary is an outline. */
  variant?: "primary" | "secondary";
  field?: string;
}

/**
 * A link that looks like a button (it goes somewhere, so it is an `<a>`). Output:
 * `<a class="lintel-button lintel-button--primary" href>`. Links opening a new tab say so
 * to screen readers.
 */
export function Button({ link, variant = "primary", field }: ButtonProps) {
  return (
    <a
      className={classNames("lintel-button", `lintel-button--${variant}`)}
      href={link.url}
      {...newTabAttributes(link.newTab)}
      data-lintel-field={field}
    >
      {link.label || link.url}
      {link.newTab && <span className="lintel-visually-hidden"> (opens in a new tab)</span>}
    </a>
  );
}

/** `target` and `rel` for a link that opens a new tab, so the new page can't reach this one. */
export function newTabAttributes(newTab: boolean | undefined) {
  return newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};
}
