import { type AnyRoute, createRoute, useParams } from "@tanstack/react-router";
import { siteImportSources, type SiteImportSource } from "./siteImport.api.js";
import { SiteImportPage } from "./SiteImportPage.js";
import { SiteImportsPage } from "./SiteImportsPage.js";

/**
 * Settings → Import for Webflow, Framer, Statamic and Umbraco, one pair of routes each, so
 * /settings/import/wordpress (data-tools) keeps its own. Added in router.tsx.
 */
export function importersRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  return siteImportSources.flatMap((source: SiteImportSource) => [
    createRoute({
      getParentRoute,
      path: `/settings/import/${source}`,
      component: function SiteImportsRoute() {
        return <SiteImportsPage source={source} />;
      },
    }),
    createRoute({
      getParentRoute,
      path: `/settings/import/${source}/$importId`,
      component: function SiteImportRoute() {
        const { importId = "" } = useParams({ strict: false });
        return <SiteImportPage key={importId} source={source} importId={importId} />;
      },
    }),
  ]);
}
