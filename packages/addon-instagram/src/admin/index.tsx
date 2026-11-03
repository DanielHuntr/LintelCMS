import { defineAdminPlugin } from "@lintel/admin/plugin";
import { Camera } from "lucide-react";
import { InstagramPage } from "./InstagramPage.js";
import { t } from "./strings.js";

/**
 * The admin half of the Instagram feed add-on: one screen to connect an account, check for
 * new posts and describe their pictures. How many posts to keep is a setting, drawn as a
 * form on the Add-ons screen. `pnpm build` bundles this into dist/admin.js.
 */
export default defineAdminPlugin({
  id: "instagram",
  sidebarItems: [
    { path: "/instagram", label: t("instagram.title"), icon: Camera, permission: "settings:read" },
  ],
  screens: [{ path: "/instagram", component: InstagramPage, permission: "settings:read" }],
});
