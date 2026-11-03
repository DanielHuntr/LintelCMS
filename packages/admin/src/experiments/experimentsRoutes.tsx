import { type AnyRoute, createRoute, useParams } from "@tanstack/react-router";
import { ExperimentPage } from "./ExperimentPage.js";
import { ExperimentsPage } from "./ExperimentsPage.js";

/**
 * The A/B testing plugin's screens, under the signed-in admin route that router.tsx passes in.
 * The sidebar only shows them while the plugin is on.
 */
export function experimentsRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const listRoute = createRoute({
    getParentRoute,
    path: "/experiments",
    component: ExperimentsPage,
  });
  const experimentRoute = createRoute({
    getParentRoute,
    path: "/experiments/$experimentId",
    component: function ExperimentRoute() {
      const { experimentId = "" } = useParams({ strict: false });
      return <ExperimentPage key={experimentId} experimentId={experimentId} />;
    },
  });
  return [listRoute, experimentRoute] as const;
}
