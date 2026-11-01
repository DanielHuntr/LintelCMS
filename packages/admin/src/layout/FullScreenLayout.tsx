import type { ReactNode } from "react";
import { AppMark } from "../design/AppMark.js";

interface FullScreenLayoutProps {
  /** Something pinned along the top, such as setup's step indicator. */
  topBar?: ReactNode;
  /** Hidden on screens that already show a large mark of their own, such as the welcome. */
  showsAppMark?: boolean;
  children: ReactNode;
}

/**
 * The frame for screens outside the admin, such as setup and sign-in: the page background
 * edge to edge, a small app mark in the corner and, during setup, the steps along the top.
 */
export function FullScreenLayout({ topBar, showsAppMark = true, children }: FullScreenLayoutProps) {
  return (
    <div className="min-h-dvh bg-background text-label">
      {topBar}
      {showsAppMark && (
        <div className="absolute top-0 left-0 p-5 sm:p-7">
          <AppMark />
        </div>
      )}
      <main>{children}</main>
    </div>
  );
}
