import { PenLine } from "lucide-react";
import { t } from "../i18n/strings.js";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { PageDraftingSettingsPage } from "./PageDraftingSettingsPage.js";

/**
 * Page drafting's place in the admin: Settings → Page drafting, where the writing model is
 * set up. The builder's "Draft a page for me" comes from `usePageDrafting` in the page design
 * screen. None of it shows while the plugin is off.
 */
export const pageDraftsAdminPlugin = defineAdminPlugin({
  id: "drafts",
  settingsRows: [
    {
      group: t("settings.siteHeader"),
      label: t("pageDrafts.settingsTitle"),
      description: t("pageDrafts.settingsDescription"),
      icon: PenLine,
      to: "/settings/page-drafting",
      permission: "settings:read",
    },
  ],
  screens: [{ path: "/settings/page-drafting", component: PageDraftingSettingsPage }],
});
