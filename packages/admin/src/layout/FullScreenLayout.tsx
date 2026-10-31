import type { ReactNode } from "react";
import { AppMark } from "../design/AppMark.js";
import { t } from "../i18n/strings.js";

interface FullScreenLayoutProps {
  /** How far through setup, from 0 to 1. Left out on screens outside the flow. */
  progress?: number;
  /** Hidden on screens that already show a large mark of their own, such as the welcome. */
  showsAppMark?: boolean;
  children: ReactNode;
}

/**
 * The frame for screens outside the admin, such as setup and sign-in: the page background
 * edge to edge, a small app mark in the corner and, during setup, a thin progress bar on top.
 */
export function FullScreenLayout({
  progress,
  showsAppMark = true,
  children,
}: FullScreenLayoutProps) {
  return (
    <div className="min-h-dvh bg-background text-label">
      {progress !== undefined && <ProgressBar progress={progress} />}
      {showsAppMark && (
        <div className="absolute top-0 left-0 p-5 sm:p-7">
          <AppMark />
        </div>
      )}
      <main>{children}</main>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <div
      role="progressbar"
      aria-label={t("setup.progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="fixed inset-x-0 top-0 z-20 h-[3px] bg-fill"
    >
      <div
        className="h-full rounded-r-full bg-accent-fill transition-[width] duration-500 ease-standard"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
