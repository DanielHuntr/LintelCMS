import { ListTree, SlidersHorizontal, Tags } from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";

/**
 * Below the collections on /content: the content that isn't a list of entries. Each row
 * appears only for people who may see it.
 */
export function SiteWideContent() {
  const canSeeTaxonomies = useCan("taxonomies:read");
  const canSeeGlobals = useCan("globals:read");
  const canSeeMenus = useCan("navigation:read");
  if (!canSeeTaxonomies && !canSeeGlobals && !canSeeMenus) return null;

  return (
    <div className="mt-10 max-w-2xl">
      <GroupedList header={t("contentModel.siteWideHeader")}>
        {canSeeGlobals && (
          <GroupedListRow
            icon={SlidersHorizontal}
            label={t("globals.title")}
            description={t("contentModel.globalsDescription")}
            to="/content/globals"
          />
        )}
        {canSeeMenus && (
          <GroupedListRow
            icon={ListTree}
            label={t("menus.title")}
            description={t("contentModel.menusDescription")}
            to="/content/navigation"
          />
        )}
        {canSeeTaxonomies && (
          <GroupedListRow
            icon={Tags}
            label={t("taxonomies.title")}
            description={t("contentModel.taxonomiesDescription")}
            to="/content/taxonomies"
          />
        )}
      </GroupedList>
    </div>
  );
}
