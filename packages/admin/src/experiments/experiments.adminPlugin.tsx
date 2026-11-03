import { Split } from "lucide-react";
import { t } from "../i18n/strings.js";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";

/**
 * The A/B testing plugin's sidebar item, while the plugin is on. Its screens are in
 * experimentsRoutes.tsx; trying another version of a page happens in the page designer.
 */
export const experimentsAdminPlugin = defineAdminPlugin({
  id: "experiments",
  sidebarItems: [
    {
      path: "/experiments",
      label: t("nav.experiments"),
      icon: Split,
      permission: "experiments:manage",
    },
  ],
});
