import { type AnyRoute, createRoute, useParams } from "@tanstack/react-router";
import { BackupsPage } from "./BackupsPage.js";
import { ImportPage } from "./ImportPage.js";
import { RestorePage } from "./RestorePage.js";
import { WordPressImportPage } from "./WordPressImportPage.js";
import { WordPressImportsPage } from "./WordPressImportsPage.js";

/**
 * Settings → Backups and Build → Import, under the signed-in admin route that
 * router.tsx passes in. Params are read with `strict: false` because these routes are
 * made for any parent; each path has exactly the one param its component reads.
 */
export function dataToolsRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  return [
    createRoute({ getParentRoute, path: "/settings/backups", component: BackupsPage }),
    createRoute({
      getParentRoute,
      path: "/settings/backups/$backupId/restore",
      component: function RestoreRoute() {
        const { backupId = "" } = useParams({ strict: false });
        return <RestorePage key={backupId} backupId={backupId} />;
      },
    }),
    createRoute({ getParentRoute, path: "/build/import", component: ImportPage }),
    createRoute({
      getParentRoute,
      path: "/build/import/wordpress",
      component: WordPressImportsPage,
    }),
    createRoute({
      getParentRoute,
      path: "/build/import/wordpress/$importId",
      component: function WordPressImportRoute() {
        const { importId = "" } = useParams({ strict: false });
        return <WordPressImportPage key={importId} importId={importId} />;
      },
    }),
  ];
}
