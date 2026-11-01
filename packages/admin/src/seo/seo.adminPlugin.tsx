import { Search } from "lucide-react";
import { t } from "../i18n/strings.js";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { EntrySeoPanel } from "./EntrySeoPanel.js";
import { RedirectsPage } from "./RedirectsPage.js";
import { SeoSettingsPage } from "./SeoSettingsPage.js";

/**
 * The SEO plugin's place in the admin: the editor's Search engines panel, and Settings →
 * Search engines with its redirects. None of it shows while the plugin is off.
 */
export const seoAdminPlugin = defineAdminPlugin({
  id: "seo",
  settingsRows: [
    {
      group: t("settings.searchHeader"),
      label: t("seo.settingsTitle"),
      description: t("settings.seoDescription"),
      icon: Search,
      to: "/settings/seo",
      permission: "settings:read",
    },
  ],
  screens: [
    { path: "/settings/seo", component: SeoSettingsPage },
    { path: "/settings/seo/redirects", component: RedirectsPage },
  ],
  editorPanels: [{ id: "search-engines", component: EntrySeoPanel }],
});
