import type { ReactNode } from "react";
import { classNames } from "../class-names.js";

export type SectionTone = "plain" | "muted" | "brand";
export type SectionSpacing = "normal" | "small" | "none";

export interface SectionProps {
  children: ReactNode;
  /** The background: the page's own, a soft grey, or the brand colour. */
  tone?: SectionTone;
  /** Room above and below. */
  spacing?: SectionSpacing;
  /** Which component this section is, for the page builder (`data-lintel-component`). */
  component?: string;
  /** The id of the section's heading, so screen readers can name the region. */
  labelledBy?: string;
  id?: string;
  className?: string;
}

/**
 * One band of a page, across its full width. Output:
 * `<section class="lintel-section lintel-section--muted">`. Put a `Container` inside to keep
 * its content to a readable width.
 */
export function Section({
  children,
  tone = "plain",
  spacing = "normal",
  component,
  labelledBy,
  id,
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      className={classNames(
        "lintel-section",
        tone !== "plain" && `lintel-section--${tone}`,
        spacing !== "normal" && `lintel-section--spacing-${spacing}`,
        className,
      )}
      aria-labelledby={labelledBy}
      data-lintel-component={component}
    >
      {children}
    </section>
  );
}
