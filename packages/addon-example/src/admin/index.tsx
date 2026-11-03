import { defineAdminPlugin } from "@lintel/admin/plugin";
import { Clock } from "lucide-react";
import { OpeningHoursPage } from "./OpeningHoursPage.js";
import { OpeningHoursWidget } from "./OpeningHoursWidget.js";
import { t } from "./strings.js";
import { SwatchEditor } from "./SwatchEditor.js";

/**
 * The admin half of the example add-on: the Colour swatch field's editor, a sidebar screen
 * and a dashboard widget for the opening hours. Its settings need no screen of their own:
 * the Add-ons screen draws a form from their schema. `pnpm build` bundles this into
 * dist/admin.js, which the admin loads when it starts.
 */
export default defineAdminPlugin({
  id: "example",
  fieldEditors: [{ type: "example.swatch", Editor: SwatchEditor }],
  sidebarItems: [
    { path: "/opening-hours", label: t("hours.title"), icon: Clock, permission: "settings:read" },
  ],
  screens: [{ path: "/opening-hours", component: OpeningHoursPage, permission: "settings:read" }],
  dashboardWidgets: [
    {
      id: "today",
      title: t("hours.title"),
      description: t("hours.widgetDescription"),
      icon: Clock,
      component: OpeningHoursWidget,
      defaultSize: "small",
      permission: "settings:read",
    },
  ],
});
