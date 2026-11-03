import { type AnyRoute, createRoute, useParams } from "@tanstack/react-router";
import { FieldsetEditorPage } from "./FieldsetEditorPage.js";
import { FieldsetsPage } from "./FieldsetsPage.js";

/** /build/fieldsets and /build/fieldsets/:handle, under the signed-in admin route. */
export function fieldsetRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const fieldsetsRoute = createRoute({
    getParentRoute,
    path: "/build/fieldsets",
    component: FieldsetsPage,
  });
  const fieldsetRoute = createRoute({
    getParentRoute,
    path: "/build/fieldsets/$handle",
    component: function FieldsetRoute() {
      const { handle = "" } = useParams({ strict: false });
      return <FieldsetEditorPage key={handle} handle={handle} />;
    },
  });
  return [fieldsetsRoute, fieldsetRoute];
}
