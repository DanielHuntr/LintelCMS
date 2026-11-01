import { LoadError } from "../api/LoadError.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { MenuEditor } from "./MenuEditor.js";
import { useMenu } from "./menus.queries.js";

/** /content/navigation/:handle: loads the menu, then hands over to the editor. */
export function MenuEditorPage({ handle }: { handle: string }) {
  const menu = useMenu(handle);

  if (menu.isError) {
    return <LoadError error={menu.error} onRetry={() => void menu.refetch()} />;
  }
  if (!menu.data) {
    return (
      <LoadingRegion label={t("menus.loading")}>
        <Skeleton className="mb-8 h-10 w-48" />
        <Skeleton className="h-56 rounded-card" />
      </LoadingRegion>
    );
  }
  return <MenuEditor key={menu.data.handle} menu={menu.data} />;
}
