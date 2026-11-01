import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ListTree, Plus } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { MenuSettingsSheet } from "./MenuSettingsSheet.js";
import { createMenu } from "./menus.api.js";
import { menuKeys, useMenus } from "./menus.queries.js";

/** /content/navigation: the site's menus, such as the main menu and the footer links. */
export function MenusPage() {
  const menus = useMenus();
  const canCreate = useCan("navigation:update");
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function create(name: string, handle: string, maxDepth: number) {
    const menu = await createMenu({ name, handle, maxDepth });
    await queryClient.invalidateQueries({ queryKey: menuKeys.menus() });
    setIsCreating(false);
    await navigate({ to: "/content/navigation/$handle", params: { handle: menu.handle } });
  }

  const newButton = (variant: "filled" | "tinted") =>
    canCreate && (
      <Button
        variant={variant}
        icon={<Plus aria-hidden="true" />}
        onClick={() => setIsCreating(true)}
      >
        {t("menus.new")}
      </Button>
    );

  return (
    <>
      <BackLink to="/content">{t("nav.content")}</BackLink>
      <LargeTitle
        title={t("menus.title")}
        subtitle={t("menus.subtitle")}
        actions={menus.data?.length === 0 ? undefined : newButton("tinted")}
      />
      {menus.isError && <LoadError error={menus.error} onRetry={() => void menus.refetch()} />}
      {menus.isPending && (
        <LoadingRegion label={t("menus.loading")}>
          <Skeleton className="h-14 rounded-card" />
        </LoadingRegion>
      )}
      {menus.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={ListTree}
            title={t("menus.emptyTitle")}
            description={t("menus.emptyDescription")}
            action={newButton("filled")}
          />
        </div>
      )}
      {menus.data && menus.data.length > 0 && (
        <GroupedList footer={t("menus.footer")}>
          {menus.data.map((menu) => (
            <GroupedListRow
              key={menu.id}
              icon={ListTree}
              label={menu.name}
              description={t("menus.itemCount", { count: menu.itemCount })}
              to={`/content/navigation/${encodeURIComponent(menu.handle)}`}
            />
          ))}
        </GroupedList>
      )}
      {isCreating && (
        <MenuSettingsSheet
          title={t("menus.newTitle")}
          description={t("menus.newDescription")}
          submitLabel={t("menus.create")}
          showsHandle
          onSubmit={create}
          onClose={() => setIsCreating(false)}
        />
      )}
    </>
  );
}
