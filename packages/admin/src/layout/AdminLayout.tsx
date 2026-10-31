import { Outlet } from "@tanstack/react-router";
import { t } from "../i18n/strings.js";
import { Sidebar } from "./Sidebar.js";
import type { SignedInUser } from "./SidebarAccount.js";

interface AdminLayoutProps {
  /** The signed-in person's permissions. Hard-coded until sign-in exists. */
  permissions: readonly string[];
  /** Shown at the bottom of the sidebar. Undefined until sign-in is wired up. */
  signedInUser?: SignedInUser;
}

/**
 * The frame around every admin screen: a floating, translucent sidebar on the left
 * and the page on the right.
 */
export function AdminLayout({ permissions, signedInUser }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-label">
      <a
        href="#main"
        className="fixed top-3 left-3 z-20 -translate-y-16 rounded-control bg-surface px-3 py-2 text-body font-medium text-accent shadow-float focus:translate-y-0 focus:focus-ring"
      >
        {t("nav.skipToContent")}
      </a>
      <Sidebar permissions={permissions} signedInUser={signedInUser} />
      {/* Leaves room for the 240px sidebar and its 12px margin. */}
      <main id="main" tabIndex={-1} className="pl-[264px] outline-none">
        <div className="mx-auto max-w-[960px] px-10 pt-14 pb-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
