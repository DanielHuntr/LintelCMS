import { defineAdminPlugin } from "@lintel/admin/plugin";
import { Mail } from "lucide-react";
import { NewsletterPage } from "./NewsletterPage.js";
import { t } from "./strings.js";

/**
 * The admin half of the Newsletter sign-up add-on: one screen under Settings for
 * connecting Mailchimp or Brevo. It is something set up once, so it sits in Settings
 * rather than in the sidebar. `pnpm build` bundles this into dist/admin.js.
 */
export default defineAdminPlugin({
  id: "newsletter",
  settingsRows: [
    {
      group: t("newsletter.settingsGroup"),
      label: t("newsletter.title"),
      description: t("newsletter.settingsDescription"),
      icon: Mail,
      to: "/settings/newsletter",
      permission: "settings:read",
    },
  ],
  screens: [
    { path: "/settings/newsletter", component: NewsletterPage, permission: "settings:read" },
  ],
});
