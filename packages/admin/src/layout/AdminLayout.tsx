import { Outlet } from "@tanstack/react-router";
import { HelpLauncher } from "../help/HelpLauncher.js";
import { t } from "../i18n/strings.js";
import { CommandPalette } from "../search/CommandPalette.js";
import { useCommandPalette } from "../search/useCommandPalette.js";
import { Sidebar } from "./Sidebar.js";
import type { SignedInUser } from "./SidebarAccount.js";

interface AdminLayoutProps {
  /** The signed-in person's permissions; decides which sections the sidebar shows. */
  permissions: readonly string[];
  /** Switched-on plugins; sections for the others are hidden. */
  enabledPlugins: readonly string[];
  /** Shown at the bottom of the sidebar. */
  signedInUser?: SignedInUser;
  onSignOut?: () => void;
}

/**
 * The frame around every admin screen: a floating, translucent sidebar on the left
 * and the page on the right.
 */
export function AdminLayout({
  permissions,
  enabledPlugins,
  signedInUser,
  onSignOut,
}: AdminLayoutProps) {
  const palette = useCommandPalette();
  return (
    <div className="min-h-screen bg-background text-label">
      <a
        href="#main"
        className="fixed top-3 left-3 z-20 -translate-y-16 rounded-control bg-surface px-3 py-2 text-body font-medium text-accent shadow-float focus:translate-y-0 focus:focus-ring"
      >
        {t("nav.skipToContent")}
      </a>
      <Sidebar
        permissions={permissions}
        enabledPlugins={enabledPlugins}
        signedInUser={signedInUser}
        onSignOut={onSignOut}
        onOpenSearch={palette.open}
      />
      <CommandPalette open={palette.isOpen} onClose={palette.close} />
      <HelpLauncher />
      {/*
        Leaves room for the 240px sidebar and its 12px margin. A size container, so screens
        that need the full width (the editor's split view) can measure it with cqw.
      */}
      <main id="main" tabIndex={-1} className="@container pl-[264px] outline-none">
        <div className="mx-auto max-w-[960px] px-10 pt-14 pb-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
