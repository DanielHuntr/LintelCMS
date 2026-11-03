import { ChartColumn } from "lucide-react";
import { t } from "../i18n/strings.js";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { EntryVisitorsPanel } from "./EntryVisitorsPanel.js";
import { VisitorsPage } from "./VisitorsPage.js";
import { VisitorsWidget } from "./VisitorsWidget.js";

/**
 * The Visitors plugin's place in the admin: the Visitors screen in the sidebar, a card on new
 * dashboards and a panel in the editor. None of it shows while the plugin is off, or to
 * people without `analytics:read`.
 */
export const analyticsAdminPlugin = defineAdminPlugin({
  id: "analytics",
  sidebarItems: [
    {
      path: "/visitors",
      label: t("nav.visitors"),
      icon: ChartColumn,
      permission: "analytics:read",
    },
  ],
  screens: [{ path: "/visitors", component: VisitorsPage, permission: "analytics:read" }],
  dashboardWidgets: [
    {
      id: "visitors",
      title: t("visitors.widget.title"),
      description: t("visitors.widget.description"),
      icon: ChartColumn,
      component: VisitorsWidget,
      defaultSize: "small",
      onDefaultDashboard: true,
      permission: "analytics:read",
    },
  ],
  editorPanels: [{ id: "visitors", component: EntryVisitorsPanel, permission: "analytics:read" }],
});
