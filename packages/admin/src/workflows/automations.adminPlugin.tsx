import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { EntryReviewSection } from "./EntryReviewSection.js";

/**
 * The Automations plugin's place in the admin, beyond its own screens (workflowsRoutes.tsx,
 * shown in the sidebar while the plugin is on): content approval in the entry editor's side
 * panel. It shows nothing for collections that don't need approval.
 */
export const automationsAdminPlugin = defineAdminPlugin({
  id: "automations",
  editorPanels: [
    {
      id: "review",
      component: function ReviewPanel({ entryId, collection }) {
        return <EntryReviewSection entryId={entryId} collectionName={collection.name} />;
      },
    },
  ],
});
