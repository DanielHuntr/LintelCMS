import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { t } from "../i18n/strings.js";
import { documentTitleFor } from "../navigation/documentTitle.js";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    document.title = documentTitleFor(pathname, siteName);
  }, [pathname, siteName]);

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
        siteName={siteName}
        signedInUser={signedInUser}
        onSignOut={onSignOut}
      />
      {/* Leaves room for the 240px sidebar and its 12px margin. */}
      <main id="main" tabIndex={-1} className="pl-[264px] outline-none">
        <div className="mx-auto max-w-[960px] px-10 pt-14 pb-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
