import { ShoppingBag } from "lucide-react";
import { t } from "../i18n/strings.js";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { SalesWidget } from "./SalesWidget.js";

/**
 * The online shop's place in the admin beyond its own screens (commerceRoutes.tsx, the Shop
 * section in the sidebar while the plugin is on): the Sales widget on the home dashboard.
 */
export const commerceAdminPlugin = defineAdminPlugin({
  id: "commerce",
  dashboardWidgets: [
    {
      id: "sales",
      title: t("dashboard.sales.title"),
      description: t("dashboard.sales.description"),
      icon: ShoppingBag,
      component: SalesWidget,
      defaultSize: "medium",
      onDefaultDashboard: true,
      permission: "commerce:read",
    },
  ],
});
