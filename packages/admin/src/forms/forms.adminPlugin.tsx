import { ListChecks } from "lucide-react";
import { t } from "../i18n/strings.js";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";

/**
 * The Forms plugin's sidebar item, after Media, while the plugin is on. Its screens are in
 * formsRoutes.tsx (the builder, the submissions inbox and spam settings).
 */
export const formsAdminPlugin = defineAdminPlugin({
  id: "forms",
  sidebarItems: [
    { path: "/forms", label: t("nav.forms"), icon: ListChecks, permission: "forms:read" },
  ],
});
