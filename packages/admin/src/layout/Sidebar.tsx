import { Link } from "@tanstack/react-router";
import { AppMark } from "../design/AppMark.js";
import { t } from "../i18n/strings.js";
import { visibleSections } from "../navigation/sections.js";
import { SidebarAccount, type SignedInUser } from "./SidebarAccount.js";

interface SidebarProps {
  permissions: readonly string[];
  enabledPlugins: readonly string[];
  /** Shown under the app's name, so people know which site they're editing. */
  siteName: string | null;
  signedInUser: SignedInUser | undefined;
  onSignOut?: () => void;
}

/**
 * The main navigation. It floats over the page background with a frosted-glass effect,
 * like the sidebar in macOS apps.
 */
export function Sidebar({
  permissions,
  enabledPlugins,
  siteName,
  signedInUser,
  onSignOut,
}: SidebarProps) {
  return (
    <aside className="fixed inset-y-3 left-3 z-10 flex w-60 flex-col rounded-panel bg-sidebar shadow-float hairline-ring backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-6">
        <AppMark />
        <span className="flex min-w-0 flex-col">
          <span className="text-headline text-label">{t("app.name")}</span>
          {siteName && (
            <span className="truncate text-footnote text-label-secondary" title={siteName}>
              {siteName}
            </span>
          )}
        </span>
      </div>

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
                {t(section.label)}
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
