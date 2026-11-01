import { definePlugin } from "../plugins/plugin-definition.js";
import { approvalsRoutes } from "./approvals/approvals.routes.js";
import { AUTOMATIONS_PLUGIN_ID } from "./engine/workflow-triggers.js";
import { notificationsRoutes } from "./notifications/notifications.routes.js";
import { workflowsRoutes } from "./workflows.routes.js";

/**
 * "Automations": workflows that start on events, on a schedule or by hand, content approval
 * and the notifications they send. Its routes answer only while it is switched on; the
 * engine, its listener on the event bus and the publishing check are set up by
 * `registerWorkflows` and do nothing while it is off.
 *
 * Its tables (`workflows`, `workflow_runs`...) are in Lintel's own migrations, so the
 * definition has no `database`.
 */
export const automationsPlugin = definePlugin({
  id: AUTOMATIONS_PLUGIN_ID,
  name: "Automations",
  description: "Approvals, notifications and connections to other services.",
  permissions: [
    {
      permission: "automations:read",
      name: "See automations",
      description: "Automations and what each run did.",
    },
    {
      permission: "automations:update",
      name: "Change automations",
      description: "Build, run and switch automations on or off, and set content approval.",
    },
  ],
  async routes(server) {
    await server.register(workflowsRoutes);
    await server.register(approvalsRoutes);
    await server.register(notificationsRoutes);
  },
});
