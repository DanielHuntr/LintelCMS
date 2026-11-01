import type { ReactNode } from "react";

interface LoadingRegionProps {
  /** Read to screen readers instead of the skeletons, e.g. "Loading posts". */
  label: string;
  /** Skeleton shapes that match the content on its way. */
  children: ReactNode;
}

/** Wraps skeletons so assistive technology announces one "Loading" instead of empty shapes. */
export function LoadingRegion({ label, children }: LoadingRegionProps) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
