import { type AnyRoute, createRoute, useParams, useSearch } from "@tanstack/react-router";
import { ContentApprovalPage } from "./ContentApprovalPage.js";
import { WorkflowBuilderPage } from "./WorkflowBuilderPage.js";
import { WorkflowsPage } from "./WorkflowsPage.js";

/**
 * The Automations screens, under the signed-in admin route that router.tsx passes in:
 *
 *   /automations                 the list, examples and content approval
 *   /automations/new?template=   a new automation, optionally from an example
 *   /automations/approval        which collections need approval
 *   /automations/$workflowId     the builder and run history
 *
 * Fixed segments ("new", "approval") win over $workflowId when matching.
 */
export function workflowsRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const listRoute = createRoute({ getParentRoute, path: "/automations", component: WorkflowsPage });

  const newRoute = createRoute({
    getParentRoute,
    path: "/automations/new",
    validateSearch: (search: Record<string, unknown>): { template?: string } => ({
      template:
        typeof search.template === "string" && search.template !== "" ? search.template : undefined,
    }),
    component: function NewWorkflowRoute() {
      const { template } = useSearch({ strict: false });
      return (
        <WorkflowBuilderPage
          key={template ?? "blank"}
          workflowId={undefined}
          templateId={template}
        />
      );
    },
  });

  const approvalRoute = createRoute({
    getParentRoute,
    path: "/automations/approval",
    component: ContentApprovalPage,
  });

  const workflowRoute = createRoute({
    getParentRoute,
    path: "/automations/$workflowId",
    component: function WorkflowRoute() {
      const { workflowId = "" } = useParams({ strict: false });
      return <WorkflowBuilderPage key={workflowId} workflowId={workflowId} />;
    },
  });

  return [listRoute, newRoute, approvalRoute, workflowRoute] as const;
}
