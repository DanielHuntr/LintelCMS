import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppMark } from "../design/AppMark.js";
import { t } from "../i18n/strings.js";
import { visibleSections } from "../navigation/sections.js";
import { isMacPlatform } from "../search/useCommandPalette.js";
import { SidebarAccount, type SignedInUser } from "./SidebarAccount.js";

interface SidebarProps {
  permissions: readonly string[];
  enabledPlugins: readonly string[];
  signedInUser: SignedInUser | undefined;
  onSignOut?: () => void;
  /** Opens the command palette. Without it, the Search button is left out. */
  onOpenSearch?: () => void;
}

/**
 * The main navigation. It floats over the page background with a frosted-glass effect,
 * like the sidebar in macOS apps.
 */
export function Sidebar({
  permissions,
  enabledPlugins,
  signedInUser,
  onSignOut,
  onOpenSearch,
}: SidebarProps) {
  return (
    <aside className="fixed inset-y-3 left-3 z-10 flex w-60 flex-col rounded-panel bg-sidebar shadow-float hairline-ring backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-6">
        <AppMark />
        <span className="text-headline text-label">{t("app.name")}</span>
      </div>

      {onOpenSearch && (
        <div className="px-2.5 pb-3">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-keyshortcuts={isMacPlatform() ? "Meta+K" : "Control+K"}
            className="flex h-9 w-full items-center gap-2.5 rounded-control bg-fill/70 px-2.5 text-body text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
          >
            <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            <span className="flex-1 text-left">{t("search.open")}</span>
            <kbd aria-hidden="true" className="font-sans text-caption text-label-tertiary">
              {isMacPlatform() ? t("search.shortcutMac") : t("search.shortcutOther")}
            </kbd>
          </button>
        </div>
      )}

      <nav aria-label={t("nav.label")} className="flex-1 overflow-y-auto px-2.5">
        <ul className="flex flex-col gap-0.5">
          {visibleSections(permissions, enabledPlugins).map((section) => (
            <li key={section.path}>
              {/* TanStack Router marks the current page's link with data-status="active". */}
              <Link
                to={section.path}
                activeOptions={{ exact: section.path === "/" }}
                className="group flex h-9 items-center gap-3 rounded-control px-2.5 text-body text-label transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring data-[status=active]:bg-accent/12 data-[status=active]:font-medium data-[status=active]:text-accent"
              >
                <section.icon
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-[18px] shrink-0 text-label-secondary transition-colors duration-150 group-data-[status=active]:text-accent"
                />
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="hairline-top mx-2.5 py-2.5">
        <SidebarAccount signedInUser={signedInUser} onSignOut={onSignOut} />
      </div>
    </aside>
  );
}
