import { classNames } from "./classNames.js";

/**
 * A grey placeholder in the shape of content that is still loading. Skeletons keep the
 * layout still while data arrives, so the page doesn't jump. Size it with `className`.
 * Put the skeletons inside a `LoadingRegion` so screen readers hear "Loading".
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={classNames("block rounded-control bg-fill motion-safe:animate-pulse", className)}
    />
  );
}
