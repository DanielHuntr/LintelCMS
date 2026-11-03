import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListTree } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { PanelSection } from "../content/PanelSection.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { setPageInMenu } from "./menus.api.js";
import { menuKeys, usePageInMenu } from "./menus.queries.js";
import type { PageInMenu } from "./menus.types.js";

const MAIN_MENU = "main";

/**
 * "In the main menu" in a page's Settings tab, with the page's label there. It changes the
 * same main menu the Menus screen shows: a link under the parent page's link for a menu
 * arranged by hand, or "hide from menu" for one that follows the page tree.
 */
export function PageMenuSection({ entryId, pageTitle }: { entryId: string; pageTitle: string }) {
  const canRead = useCan("navigation:read");
  const page = usePageInMenu(MAIN_MENU, entryId, canRead);
  if (!canRead) return null;
  return (
    <PanelSection
      title={t("pageMenu.heading")}
      value={
        page.data && (page.data.inMenu ? t("pageHome.panel.inMenu") : t("pageHome.panel.notInMenu"))
      }
    >
      {page.isPending && (
        <p className="text-footnote text-label-secondary">{t("pageMenu.loading")}</p>
      )}
      {page.isError && <p className="text-footnote text-label-secondary">{t("pageMenu.noMenu")}</p>}
      {page.data && (
        <PageMenuControls
          key={`${page.data.inMenu}-${page.data.label}`}
          entryId={entryId}
          pageTitle={pageTitle}
          current={page.data}
        />
      )}
    </PanelSection>
  );
}

function PageMenuControls({
  entryId,
  pageTitle,
  current,
}: {
  entryId: string;
  pageTitle: string;
  current: PageInMenu;
}) {
  const queryClient = useQueryClient();
  const canChange = useCan("navigation:update");
  const [label, setLabel] = useState(current.label);
  const [status, setStatus] = useState<{ tone: "saved" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save(change: { inMenu: boolean; label?: string }) {
    setIsSaving(true);
    try {
      const saved = await setPageInMenu(MAIN_MENU, entryId, change);
      queryClient.setQueryData(menuKeys.page(MAIN_MENU, entryId), saved);
      void queryClient.invalidateQueries({ queryKey: menuKeys.menu(MAIN_MENU) });
      void queryClient.invalidateQueries({ queryKey: menuKeys.menus() });
      setStatus({ tone: "saved", text: t("pageMenu.saved") });
    } catch (error) {
      setStatus({
        tone: "error",
        text: t("pageMenu.couldNotSave", { reason: describeError(error) }),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Toggle
          label={t("pageMenu.toggle")}
          checked={current.inMenu}
          disabled={!canChange || isSaving}
          onCheckedChange={(inMenu) => void save({ inMenu, label: label.trim() })}
          describedBy={`page-menu-hint-${entryId}`}
        />
        <p id={`page-menu-hint-${entryId}`} className="text-caption text-label-secondary">
          {current.menu.source === "pageTree"
            ? t("pageMenu.followsTree")
            : t("pageMenu.toggleHint")}
        </p>
      </div>
      {current.inMenu && (
        <TextField
          label={t("pageMenu.label")}
          hint={t("pageMenu.labelHint")}
          placeholder={pageTitle}
          value={label}
          disabled={!canChange}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => {
            if (label.trim() !== current.label) void save({ inMenu: true, label: label.trim() });
          }}
        />
      )}
      <div className="flex items-center gap-3 text-footnote">
        <Link
          to="/content/navigation/$handle"
          params={{ handle: MAIN_MENU }}
          className="inline-flex min-h-6 items-center gap-1.5 rounded-[4px] font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
        >
          <ListTree aria-hidden="true" strokeWidth={1.75} className="size-4" />
          {t("pageMenu.openMenu")}
        </Link>
        <span
          role="status"
          className={status?.tone === "error" ? "text-danger" : "text-label-secondary"}
        >
          {status?.text}
        </span>
      </div>
    </div>
  );
}
