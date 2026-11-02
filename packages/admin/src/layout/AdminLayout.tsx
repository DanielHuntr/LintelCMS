import { hasPermission } from "@lintel/core/permissions";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/** Below this width (Tailwind's `md`) the sidebar folds away behind a menu button. */
const NARROW_SCREEN = "(max-width: 767.98px)";

/**
 * The frame around every admin screen: a floating, translucent sidebar on the left
 * and the page on the right. On a phone the sidebar opens over the page from a menu
 * button, so the page can use the whole width.
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
  // The address the menu was opened on: going anywhere else closes it.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const isMenuOpen = menuOpenOn === pathname;
  const setIsMenuOpen = (open: boolean) => setMenuOpenOn(open ? pathname : null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.title = documentTitleFor(pathname, siteName);
  }, [pathname, siteName]);

  // The menu also closes when the window grows wide enough for the sidebar.
  useEffect(() => {
    const narrow = window.matchMedia?.(NARROW_SCREEN);
    if (!narrow) return;
    const closeWhenWide = () => {
      if (!narrow.matches) setMenuOpenOn(null);
    };
    narrow.addEventListener("change", closeWhenWide);
    return () => narrow.removeEventListener("change", closeWhenWide);
  }, []);
  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpenOn(null);
      menuButton.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

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
      <button
        ref={menuButton}
        type="button"
        onClick={() => setIsMenuOpen(true)}
        aria-label={t("nav.openMenu")}
        aria-expanded={isMenuOpen}
        aria-controls="admin-sidebar"
        className="fixed top-4 inset-s-4 z-20 flex size-9 items-center justify-center rounded-full bg-surface text-label-secondary shadow-float hairline-ring transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring motion-safe:active:scale-95 md:hidden"
      >
        <Menu aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </button>
      {isMenuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 z-30 bg-scrim md:hidden"
        />
      )}
      <Sidebar
        id="admin-sidebar"
        isOpenOnNarrowScreens={isMenuOpen}
        onCloseOnNarrowScreens={() => {
          setIsMenuOpen(false);
          menuButton.current?.focus();
        }}
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
        On a phone the page has the whole width: the sidebar is folded away, and the page
        starts below the menu and help buttons, so the right gutter matches the left.
      */}
      <main
        id="main"
        tabIndex={-1}
        inert={isMenuOpen}
        className="@container outline-none md:ps-[264px]"
      >
        <div className="pt-14 pe-(--page-gutter) pb-20 pl-(--page-gutter) [--page-gutter:clamp(1.5rem,3.5cqw,4rem)] max-md:[--page-gutter:1rem] md:pe-16">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
