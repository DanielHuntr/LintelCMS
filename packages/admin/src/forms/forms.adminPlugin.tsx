import { ListChecks } from "lucide-react";
import { t } from "../i18n/strings.js";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { ComingSoonPage } from "../sections/ComingSoonPage.js";

/** The Forms plugin's place in the admin: a sidebar section saying what is on the way. */
export const formsAdminPlugin = defineAdminPlugin({
  id: "forms",
  sidebarItems: [
    { path: "/forms", label: t("nav.forms"), icon: ListChecks, permission: "forms:read" },
  ],
  screens: [
    {
      path: "/forms",
      permission: "forms:read",
      component: function FormsScreen() {
        return <ComingSoonPage title="nav.forms" />;
      },
    },
  ],
});
