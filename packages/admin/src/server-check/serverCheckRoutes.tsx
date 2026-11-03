import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { ServerCheckPage } from "./ServerCheckPage.js";

/** Settings → This server, under the signed-in admin route router.tsx passes in. */
export function serverCheckRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  return [createRoute({ getParentRoute, path: "/settings/server", component: ServerCheckPage })];
}
