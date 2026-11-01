import { defineAdminPlugin } from "@lintel/admin/plugin";
import { CalendarClock, CalendarDays } from "lucide-react";
import { BookingFormPage } from "./BookingFormPage.js";
import { BookingSettingsPage } from "./BookingSettingsPage.js";
import { BookingsPage } from "./BookingsPage.js";
import { BookingsWeekTab } from "./BookingsWeekTab.js";
import { t } from "./strings.js";
import { TodaysBookingsWidget } from "./TodaysBookingsWidget.js";

/**
 * The admin half of the Bookings plugin. Lintel's build imports it from `./admin` because
 * the package is listed in lintel.config.ts. Its id matches the server half's, and none of
 * this shows while the plugin is switched off.
 */
export default defineAdminPlugin({
  id: "bookings",
  sidebarItems: [
    {
      path: "/bookings",
      label: t("bookings.title"),
      icon: CalendarDays,
      permission: "bookings:read",
    },
  ],
  screens: [
    { path: "/bookings", component: BookingsPage, permission: "bookings:read" },
    { path: "/bookings/settings", component: BookingSettingsPage, permission: "settings:read" },
    { path: "/bookings/$bookingId", component: BookingFormPage, permission: "bookings:read" },
  ],
  settingsRows: [
    {
      group: t("bookings.settingsGroup"),
      label: t("bookings.settingsTitle"),
      description: t("bookings.settingsDescription"),
      icon: CalendarClock,
      to: "/bookings/settings",
      permission: "settings:read",
    },
  ],
  dashboardWidgets: [
    {
      id: "today",
      title: t("bookings.todayTitle"),
      description: t("bookings.todayDescription"),
      icon: CalendarClock,
      component: TodaysBookingsWidget,
      defaultSize: "medium",
      permission: "bookings:read",
      onDefaultDashboard: true,
    },
  ],
  dashboardTabs: [
    {
      section: "/",
      id: "week",
      label: t("bookings.weekTab"),
      component: BookingsWeekTab,
      permission: "bookings:read",
    },
  ],
});
