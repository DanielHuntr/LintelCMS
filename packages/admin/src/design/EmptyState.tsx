import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "./classNames.js";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Usually one Button that fixes the emptiness, e.g. "Create a page". */
  action?: ReactNode;
  /** "page" fills a whole screen; "card" sits quietly inside a Card. */
  size?: "card" | "page";
}

/** What to show when there is nothing yet: says what will appear here and, ideally, how to start. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "card",
}: EmptyStateProps) {
  const isPage = size === "page";

  return (
    <div
      className={classNames(
        "flex flex-1 flex-col items-center justify-center text-center",
        isPage ? "gap-3 px-6 py-24" : "gap-2 px-4 py-8",
      )}
    >
      <span
        className={classNames(
          "mb-1 flex items-center justify-center rounded-full bg-fill text-label-secondary",
          isPage ? "size-16" : "size-11",
        )}
      >
        <Icon aria-hidden="true" strokeWidth={1.5} className={isPage ? "size-7" : "size-5"} />
      </span>
      <p className={classNames("text-label", isPage ? "text-title" : "text-headline")}>{title}</p>
      {description && (
        <p
          className={classNames(
            "text-balance text-label-secondary",
            isPage ? "max-w-md text-body" : "max-w-sm text-footnote",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
