import { Feather, Globe, Layers, Newspaper, ShoppingBag, TreePine } from "lucide-react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { t } from "../i18n/strings.js";
import { useSession } from "../session/SessionContext.js";

/**
 * Settings → Import's "Move your site to Lintel": one row per system people move from.
 * Shopify's importer lives in the shop, so it is offered while the shop is switched on.
 */
export function MoveYourSiteList() {
  const shopOn = useSession().enabledPlugins.includes("commerce");
  return (
    <GroupedList header={t("import.moveHeader")} footer={t("import.moveFooter")}>
      <GroupedListRow
        icon={Newspaper}
        label={t("import.wordpressTitle")}
        description={t("import.wordpressDescription")}
        to="/settings/import/wordpress"
      />
      <GroupedListRow
        icon={Globe}
        label={t("import.webflowTitle")}
        description={t("import.webflowDescription")}
        to="/settings/import/webflow"
      />
      <GroupedListRow
        icon={Layers}
        label={t("import.framerTitle")}
        description={t("import.framerDescription")}
        to="/settings/import/framer"
      />
      <GroupedListRow
        icon={Feather}
        label={t("import.statamicTitle")}
        description={t("import.statamicDescription")}
        to="/settings/import/statamic"
      />
      <GroupedListRow
        icon={TreePine}
        label={t("import.umbracoTitle")}
        description={t("import.umbracoDescription")}
        to="/settings/import/umbraco"
      />
      {shopOn && (
        <GroupedListRow
          icon={ShoppingBag}
          label={t("import.shopifyTitle")}
          description={t("import.shopifyDescription")}
          to="/commerce/import/shopify"
        />
      )}
    </GroupedList>
  );
}
