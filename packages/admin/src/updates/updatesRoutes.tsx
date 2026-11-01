import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { AboutPage } from "./AboutPage.js";
import { UpdatesPage } from "./UpdatesPage.js";

/** Settings → Updates and Settings → About, under the signed-in admin route router.tsx passes in. */
export function updatesRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  return [
    createRoute({ getParentRoute, path: "/settings/updates", component: UpdatesPage }),
    createRoute({ getParentRoute, path: "/settings/about", component: AboutPage }),
  ];
}
