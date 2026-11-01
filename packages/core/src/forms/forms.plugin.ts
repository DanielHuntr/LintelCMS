import { definePlugin } from "../plugins/plugin-definition.js";
import { ensureFormBlockOnPages } from "./form-block.js";
import { formsRoutes } from "./forms.routes.js";
import { publicFormsRoutes } from "./public-forms.routes.js";
import { submissionsRoutes } from "./submissions.routes.js";

/**
 * Forms: the form builder, the submissions inbox, notification emails, spam checks and the
 * public endpoints websites post to. Its routes answer only while it is switched on (404
 * PLUGIN_NOT_ENABLED otherwise); what they need, and the retention job, are set up by
 * `registerForms`. Switching it on adds the Form section to pages.
 *
 * Its tables (`forms`, `form_submissions`, `form_submission_notes`) are in Lintel's own
 * migrations, so the definition has no `database`.
 */
export const formsPlugin = definePlugin({
  id: "forms",
  name: "Forms",
  description: "Contact forms and submissions.",
  permissions: [
    { permission: "forms:read", name: "See forms", description: "Forms and what people sent." },
    {
      permission: "forms:update",
      name: "Change forms",
      description: "Build forms, and mark and annotate submissions.",
    },
    {
      permission: "forms:delete",
      name: "Delete forms",
      description: "Delete forms and submissions, and erase one person's answers.",
    },
  ],
  createContent: ensureFormBlockOnPages,
  async routes(server) {
    const context = () => server.forms.context();
    await server.register(formsRoutes, { context });
    await server.register(submissionsRoutes, { context });
    await server.register(publicFormsRoutes, {
      context,
      verifyTurnstile: (check) => server.forms.verifyTurnstile(check),
    });
  },
});
