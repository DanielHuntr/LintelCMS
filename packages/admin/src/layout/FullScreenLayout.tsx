import type { ReactNode } from "react";
import { BrandLogo } from "../branding/BrandLogo.js";

interface FullScreenLayoutProps {
  /** Something pinned along the top, such as setup's step indicator. */
  topBar?: ReactNode;
  /** Hidden on screens that already show a large mark of their own, such as the welcome. */
  showsAppMark?: boolean;
  /** A picture behind everything, such as the sign-in background chosen in Branding. */
  backgroundImage?: string | null;
  children: ReactNode;
}

/**
 * The frame for screens outside the admin, such as setup and sign-in: the page background
 * edge to edge, a small app mark in the corner and, during setup, the steps along the top.
 */
export function FullScreenLayout({
  topBar,
  showsAppMark = true,
  backgroundImage,
  children,
}: FullScreenLayoutProps) {
  return (
    <div className="relative min-h-dvh bg-background text-label">
      {backgroundImage && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${encodeURI(backgroundImage)}")` }}
        />
      )}
      {topBar}
      {showsAppMark && (
        <div className="absolute top-0 inset-s-0 p-5 sm:p-7">
          <BrandLogo showsName={false} />
        </div>
      )}
      <main className="relative">{children}</main>
    </div>
  );
}
