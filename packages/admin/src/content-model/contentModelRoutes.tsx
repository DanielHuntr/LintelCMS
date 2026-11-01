import { type AnyRoute, createRoute, useParams } from "@tanstack/react-router";
import { GlobalFieldsPage } from "../globals/GlobalFieldsPage.js";
import { GlobalSetPage } from "../globals/GlobalSetPage.js";
import { GlobalsPage } from "../globals/GlobalsPage.js";
import { LanguagesPage } from "../locales/LanguagesPage.js";
import { MenuEditorPage } from "../menus/MenuEditorPage.js";
import { MenusPage } from "../menus/MenusPage.js";
import { RequirePermission } from "../session/RequirePermission.js";
import { TaxonomiesPage } from "../taxonomies/TaxonomiesPage.js";
import { TaxonomyPage } from "../taxonomies/TaxonomyPage.js";

/**
 * The screens for content that isn't a collection's entries: taxonomies, global sets and
 * menus (under Content), and the site's languages (under Settings). They sit under the
 * signed-in admin route, which router.tsx passes in.
 *
 * Their paths come before "/content/$collection" in matching because fixed segments win
 * over parameters; the API keeps these handles from being used for collections.
 *
 * Params are read with `strict: false` because these routes are made for any parent; each
 * path has exactly the one param its component reads.
 */
export function contentModelRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const taxonomiesRoute = createRoute({
    getParentRoute,
    path: "/content/taxonomies",
    component: TaxonomiesPage,
  });

  const taxonomyRoute = createRoute({
    getParentRoute,
    path: "/content/taxonomies/$taxonomy",
    component: function TaxonomyRoute() {
      const { taxonomy = "" } = useParams({ strict: false });
      return <TaxonomyPage key={taxonomy} handle={taxonomy} />;
    },
  });

  const globalsRoute = createRoute({
    getParentRoute,
    path: "/content/globals",
    component: GlobalsPage,
  });

  const globalSetRoute = createRoute({
    getParentRoute,
    path: "/content/globals/$handle",
    component: function GlobalSetRoute() {
      const { handle = "" } = useParams({ strict: false });
      return <GlobalSetPage key={handle} handle={handle} />;
    },
  });

  const globalFieldsRoute = createRoute({
    getParentRoute,
    path: "/content/globals/$handle/fields",
    component: function GlobalFieldsRoute() {
      const { handle = "" } = useParams({ strict: false });
      return <GlobalFieldsPage key={handle} handle={handle} />;
    },
  });

  const menusRoute = createRoute({
    getParentRoute,
    path: "/content/navigation",
    component: MenusPage,
  });

  const menuRoute = createRoute({
    getParentRoute,
    path: "/content/navigation/$handle",
    component: function MenuRoute() {
      const { handle = "" } = useParams({ strict: false });
      return <MenuEditorPage key={handle} handle={handle} />;
    },
  });

  const languagesRoute = createRoute({
    getParentRoute,
    path: "/settings/languages",
    component: () => (
      <RequirePermission permission="settings:read">
        <LanguagesPage />
      </RequirePermission>
    ),
  });

  return [
    taxonomiesRoute,
    taxonomyRoute,
    globalsRoute,
    globalSetRoute,
    globalFieldsRoute,
    menusRoute,
    menuRoute,
    languagesRoute,
  ] as const;
}
