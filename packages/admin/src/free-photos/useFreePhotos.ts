import { hasPermission } from "@lintel/core/permissions";
import { useOptionalSession } from "../session/SessionContext.js";

/** The plugin's id, as on the server (packages/core/src/free-photos/free-photos.plugin.ts). */
export const FREE_PHOTOS_PLUGIN_ID = "free-photos";

/**
 * Whether to offer free photos here: the plugin is switched on and the person may upload
 * media. Outside the signed-in admin (a component's own test) it is never offered.
 */
export function useCanAddFreePhotos(): boolean {
  const session = useOptionalSession();
  if (!session) return false;
  return (
    session.enabledPlugins.includes(FREE_PHOTOS_PLUGIN_ID) &&
    hasPermission(session.permissions, "media:upload")
  );
}
