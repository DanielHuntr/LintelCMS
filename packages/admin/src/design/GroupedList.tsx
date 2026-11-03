import { useId, type ReactNode } from "react";

interface GroupedListProps {
  /** A short heading above the group, e.g. "Notifications". */
  header?: string;
  /**
   * The header's heading level: 2 under a screen's title (the usual), 3 inside a section or
   * panel that has its own h2.
   */
  headingLevel?: 2 | 3;
  /** A sentence below the group that explains its settings. */
  footer?: string;
  /** GroupedListRow elements. */
  children: ReactNode;
}

/** An inset, rounded group of rows, like a section in iOS Settings. */
export function GroupedList({ header, footer, headingLevel = 2, children }: GroupedListProps) {
  const headerId = useId();
  // A heading, so screen reader users can jump between groups (LINTEL-A11Y-036).
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <div className="flex flex-col gap-1.5">
      {header && (
        <Heading id={headerId} className="px-4 text-footnote font-medium text-label-secondary">
          {header}
        </Heading>
      )}
      <ul
        aria-labelledby={header ? headerId : undefined}
        className="overflow-hidden rounded-card bg-surface"
      >
        {children}
      </ul>
      {footer && <p className="px-4 text-footnote text-label-secondary">{footer}</p>}
    </div>
  );
}
