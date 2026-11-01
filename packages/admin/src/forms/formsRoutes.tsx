import {
  type AnyRoute,
  createRoute,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { FormBuilderPage } from "./FormBuilderPage.js";
import { FormsPage } from "./FormsPage.js";
import { FormsSettingsPage } from "./FormsSettingsPage.js";
import type { SubmissionFilter } from "./forms.types.js";
import { SubmissionsPage, type SubmissionsView } from "./SubmissionsPage.js";

const filters: readonly string[] = ["unread", "starred"] satisfies SubmissionFilter[];

/**
 * The Forms plugin's screens, under the signed-in admin route that router.tsx passes in.
 * The sidebar only shows Forms while the plugin is on (see src/navigation/sections.ts).
 *
 * "/forms/settings" is a fixed path, so it wins over "/forms/$formId".
 */
export function formsRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const formsRoute = createRoute({ getParentRoute, path: "/forms", component: FormsPage });

  const settingsRoute = createRoute({
    getParentRoute,
    path: "/forms/settings",
    component: FormsSettingsPage,
  });

  const formRoute = createRoute({
    getParentRoute,
    path: "/forms/$formId",
    component: function FormRoute() {
      const { formId = "" } = useParams({ strict: false });
      return <FormBuilderPage key={formId} formId={formId} />;
    },
  });

  const submissionsRoute = createRoute({
    getParentRoute,
    path: "/forms/$formId/submissions",
    // The open submission, search, filter and page live in the address, so a link from a
    // notification email opens the right one and a reload keeps your place.
    validateSearch: (search: Record<string, unknown>): SubmissionsView => ({
      submission:
        typeof search.submission === "string" && search.submission !== ""
          ? search.submission
          : undefined,
      search: typeof search.search === "string" && search.search !== "" ? search.search : undefined,
      filter: filters.includes(String(search.filter))
        ? (search.filter as SubmissionFilter)
        : undefined,
      page:
        typeof search.page === "number" && search.page > 1 ? Math.floor(search.page) : undefined,
    }),
    component: function SubmissionsRoute() {
      const { formId = "" } = useParams({ strict: false });
      const view = useSearch({ strict: false }) as SubmissionsView;
      const navigate = useNavigate();
      const changeView = useCallback(
        (next: SubmissionsView) => void navigate({ to: ".", search: next, replace: true }),
        [navigate],
      );
      return <SubmissionsPage key={formId} formId={formId} view={view} onViewChange={changeView} />;
    },
  });

  return [formsRoute, settingsRoute, formRoute, submissionsRoute] as const;
}
