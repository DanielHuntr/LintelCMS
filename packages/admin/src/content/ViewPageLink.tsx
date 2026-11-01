import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { ViewPageTarget } from "./viewPage.js";

interface ViewPageLinkProps {
  target: ViewPageTarget;
  className: string;
  /** For icon-only links, which have no visible text. */
  label?: string;
  children: ReactNode;
}

/** Opens the live page (or Lintel's simple preview of it) in a new tab. */
export function ViewPageLink({ target, className, label, children }: ViewPageLinkProps) {
  if (target.kind === "website") {
    return (
      <a
        href={target.href}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        title={label}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      to="/content/$collection/$entryId/view"
      params={{ collection: target.collection, entryId: target.entryId }}
      target="_blank"
      aria-label={label}
      title={label}
      className={className}
    >
      {children}
    </Link>
  );
}
