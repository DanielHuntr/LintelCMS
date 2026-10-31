import { useId, type ReactNode } from "react";

interface GroupedListProps {
  /** A short heading above the group, e.g. "Notifications". */
  header?: string;
  /** A sentence below the group that explains its settings. */
  footer?: string;
  /** GroupedListRow elements. */
  children: ReactNode;
}

/** An inset, rounded group of rows, like a section in iOS Settings. */
export function GroupedList({ header, footer, children }: GroupedListProps) {
  const headerId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      {header && (
        <p id={headerId} className="px-4 text-footnote font-medium text-label-secondary">
          {header}
        </p>
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
