import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { HandMadeItems } from "./MenuEditor.js";
import { useMenu } from "./menus.queries.js";
import type { Menu } from "./menus.types.js";
import { PageTreeMenuList } from "./PageTreeMenuList.js";
import { useMenuDraft } from "./useMenuDraft.js";

/**
 * The menu editor inside the page builder's Content tab, for the Header, Menu and Menu
 * drawer: add pages, rename, reorder and nest, then Done saves to the same menu the Menus
 * screen shows (every page using it changes). "Open in Menus" has the rest.
 */
export function InlineMenuEditor({ handle, onClose }: { handle: string; onClose: () => void }) {
  const menu = useMenu(handle);
  if (menu.isError) {
    return <LoadError error={menu.error} onRetry={() => void menu.refetch()} />;
  }
  if (!menu.data) {
    return (
      <LoadingRegion label={t("builderMenu.loading")}>
        <Skeleton className="h-32 w-full rounded-card" />
      </LoadingRegion>
    );
  }
  return <LoadedInlineMenuEditor key={menu.data.handle} menu={menu.data} onClose={onClose} />;
}

function LoadedInlineMenuEditor({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const queryClient = useQueryClient();
  const canEdit = useCan("navigation:update");
  const draft = useMenuDraft(menu);
  const followsTree = draft.source === "pageTree";

  async function done() {
    if (draft.isUnsaved && !(await draft.save())) return;
    // The canvas draws the menus from their cache, so it shows the change straight away.
    await queryClient.invalidateQueries({ queryKey: ["menus", "builder"] });
    onClose();
  }

  return (
    <section
      aria-label={t("builderMenu.title", { name: menu.name })}
      className="flex flex-col gap-3 rounded-card bg-fill/40 p-3"
    >
      <h3 className="text-footnote font-semibold text-label">
        {t("builderMenu.title", { name: menu.name })}
      </h3>
      {followsTree && (
        <p className="text-caption text-label-secondary">{t("builderMenu.followsTree")}</p>
      )}
      {draft.saveError && (
        <p role="alert" className="text-caption text-danger">
          {draft.saveError}
        </p>
      )}
      {followsTree ? (
        <PageTreeMenuList draft={draft} compact />
      ) : (
        <HandMadeItems draft={draft} menuName={menu.name} canEdit={canEdit} compact />
      )}
      <div className="flex items-center gap-2">
        <Button size="small" onClick={() => void done()} disabled={draft.isSaving}>
          {draft.isSaving ? t("builderMenu.saving") : t("builderMenu.done")}
        </Button>
        <Link
          to="/content/navigation/$handle"
          params={{ handle: menu.handle }}
          target="_blank"
          className="inline-flex items-center gap-1 rounded-[4px] text-caption font-medium text-accent hover:underline focus-visible:focus-ring"
        >
          {t("builderMenu.openFull")}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
