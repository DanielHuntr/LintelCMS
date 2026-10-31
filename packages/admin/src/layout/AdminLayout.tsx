import { Link, Outlet } from "@tanstack/react-router";
import { t } from "../i18n/strings.js";
import { visibleSections } from "../navigation/sections.js";

interface AdminLayoutProps {
  /** The signed-in person's permissions. Hard-coded until sign-in exists. */
  permissions: readonly string[];
}

/**
 * The frame around every admin screen: the sidebar on the left, the page on the right.
 */
export function AdminLayout({ permissions }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-900">
      <aside className="w-60 shrink-0 border-r border-stone-200 bg-white p-4">
        <p className="mb-6 px-3 text-lg font-semibold">{t("app.name")}</p>
        <nav aria-label={t("nav.label")}>
          <ul className="space-y-1">
            {visibleSections(permissions).map((section) => (
              <li key={section.path}>
                <Link
                  to={section.path}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-brand"
                  activeProps={{ className: "bg-brand-soft font-medium" }}
                  activeOptions={{ exact: section.path === "/" }}
                >
                  {t(section.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
