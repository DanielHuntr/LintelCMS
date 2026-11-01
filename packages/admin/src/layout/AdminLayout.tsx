import { hasPermission } from "@lintel/core/permissions";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useContentModelEvents } from "../content-model-sync/useContentModelEvents.js";
import { useBranding } from "../branding/brandingStore.js";
import { HelpLauncher } from "../help/HelpLauncher.js";
import { t } from "../i18n/strings.js";
import { documentTitleFor } from "../navigation/documentTitle.js";
import { CommandPalette } from "../search/CommandPalette.js";
import { useCommandPalette } from "../search/useCommandPalette.js";
import { NotificationsButton } from "../workflows/NotificationsButton.js";
import { UpdatesSidebarLink } from "../updates/UpdatesSidebarLink.js";
import { UpdatingBanner } from "../updates/UpdatingBanner.js";
import { Sidebar } from "./Sidebar.js";
import type { SignedInUser } from "./SidebarAccount.js";

interface AdminLayoutProps {
  /** The signed-in person's permissions; decides which sections the sidebar shows. */
  permissions: readonly string[];
  /** Switched-on plugins; sections for the others are hidden. */
  enabledPlugins: readonly string[];
  /** The site's name, in the browser tab ("Dashboard · Brightside Bakery") and the sidebar. */
  siteName?: string | null;
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
  siteName = null,
  signedInUser,
  onSignOut,
}: AdminLayoutProps) {
  const palette = useCommandPalette();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    document.title = documentTitleFor(pathname, siteName);
  }, [pathname, siteName]);

  // Screens showing content types reload when a developer changes the content model files.
  useContentModelEvents();
  // The "?" button opens Lintel's own help pages, so it goes when an agency hides them.
  const { hideLintelHelp } = useBranding();
  return (
    <div className="min-h-screen bg-background text-label">
      <a
        href="#main"
        className="fixed top-3 inset-s-3 z-20 -translate-y-16 rounded-control bg-surface px-3 py-2 text-body font-medium text-accent shadow-float focus:translate-y-0 focus:focus-ring"
      >
        {t("nav.skipToContent")}
      </a>
      <Sidebar
        permissions={permissions}
        enabledPlugins={enabledPlugins}
        siteName={siteName}
        signedInUser={signedInUser}
        onSignOut={onSignOut}
        onOpenSearch={palette.open}
        notice={hasPermission(permissions, "updates:read") && <UpdatesSidebarLink />}
      />
      <UpdatingBanner />
      <CommandPalette open={palette.isOpen} onClose={palette.close} />
      {!hideLintelHelp && <HelpLauncher />}
      {enabledPlugins.includes("automations") && <NotificationsButton />}
      {/*
        Leaves room for the 240px sidebar and its 12px margin. The gutters grow with the
        window; how wide each screen goes is its own choice (design/Page.tsx). The right
        gutter never gets narrower than 4rem, which keeps page actions clear of the help
        button in the corner. A size container, so screens can measure the page area with cqw
        and container queries; sticky toolbars use --page-gutter to reach the edges.
      */}
      <main id="main" tabIndex={-1} className="@container ps-[264px] outline-none">
        <div className="pt-14 pe-16 pb-20 pl-(--page-gutter) [--page-gutter:clamp(1.5rem,3.5cqw,4rem)]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
