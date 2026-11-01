import { useNavigate } from "@tanstack/react-router";
import { ListTree, type LucideIcon, SlidersHorizontal, Tag, Tags } from "lucide-react";
import { useGlobalSets } from "../globals/globals.queries.js";
import { t, type StringKey } from "../i18n/strings.js";
import { useMenus } from "../menus/menus.queries.js";
import { useCan } from "../session/SessionContext.js";
import { useTaxonomies } from "../taxonomies/taxonomies.queries.js";
import { useContentTree } from "./ContentTreeContext.js";
import type { TreeKey } from "./treeState.js";
import { TreeRow } from "./TreeRow.js";

interface SiteWideSectionProps {
  tabStopKey: TreeKey | undefined;
  onRowFocus: (key: TreeKey) => void;
}

/**
 * Content that isn't a list of entries, in a section of its own under the collections:
 * global settings, menus and taxonomies, each a folder of the sets, menus or groups there
 * are. Each folder appears only for people who may see it.
 */
export function SiteWideSection({ tabStopKey, onRowFocus }: SiteWideSectionProps) {
  const canSeeGlobals = useCan("globals:read");
  const canSeeMenus = useCan("navigation:read");
  const canSeeTaxonomies = useCan("taxonomies:read");
  if (!canSeeGlobals && !canSeeMenus && !canSeeTaxonomies) return null;

  const shared = { tabStopKey, onRowFocus };
  return (
    <>
      <h2 className="px-2 pt-5 pb-1 text-caption font-semibold text-label-secondary uppercase">
        {t("tree.siteWideHeading")}
      </h2>
      <ul role="tree" aria-label={t("tree.siteWideHeading")} className="flex flex-col">
        {canSeeGlobals && <GlobalsFolder {...shared} />}
        {canSeeMenus && <MenusFolder {...shared} />}
        {canSeeTaxonomies && <TaxonomiesFolder {...shared} />}
      </ul>
    </>
  );
}

interface FolderProps extends SiteWideSectionProps {
  folderKey: TreeKey;
  label: StringKey;
  icon: LucideIcon;
  itemIcon: LucideIcon;
  to: string;
  items: { key: string; name: string; to: string }[] | undefined;
}

function SiteWideFolder({
  folderKey,
  label,
  icon,
  itemIcon,
  to,
  items,
  tabStopKey,
  onRowFocus,
}: FolderProps) {
  const tree = useContentTree();
  const navigate = useNavigate();
  const isExpanded = tree.expanded.has(folderKey) && (items?.length ?? 0) > 0;

  return (
    <TreeRow
      treeKey={folderKey}
      depth={0}
      label={t(label)}
      icon={icon}
      isSelected={tree.selectedKey === folderKey}
      isTabStop={tabStopKey === folderKey}
      onFocus={() => onRowFocus(folderKey)}
      onOpen={() => void navigate({ to })}
      isExpandable={(items?.length ?? 0) > 0}
      isExpanded={isExpanded}
      onToggle={() => tree.toggle(folderKey)}
    >
      {isExpanded && (
        <ul role="group">
          {items?.map((item) => (
            <TreeRow
              key={item.key}
              treeKey={item.key}
              parentKey={folderKey}
              depth={1}
              label={item.name}
              icon={itemIcon}
              isSelected={tree.selectedKey === item.key}
              isTabStop={tabStopKey === item.key}
              onFocus={() => onRowFocus(item.key)}
              onOpen={() => void navigate({ to: item.to })}
              isExpandable={false}
              isExpanded={false}
            />
          ))}
        </ul>
      )}
    </TreeRow>
  );
}

function GlobalsFolder(props: SiteWideSectionProps) {
  const sets = useGlobalSets();
  return (
    <SiteWideFolder
      {...props}
      folderKey="site:globals"
      label="tree.globals"
      icon={SlidersHorizontal}
      itemIcon={SlidersHorizontal}
      to="/content/globals"
      items={sets.data?.map((set) => ({
        key: `globals:${set.handle}`,
        name: set.name,
        to: `/content/globals/${set.handle}`,
      }))}
    />
  );
}

function MenusFolder(props: SiteWideSectionProps) {
  const menus = useMenus();
  return (
    <SiteWideFolder
      {...props}
      folderKey="site:menus"
      label="tree.menus"
      icon={ListTree}
      itemIcon={ListTree}
      to="/content/navigation"
      items={menus.data?.map((menu) => ({
        key: `menus:${menu.handle}`,
        name: menu.name,
        to: `/content/navigation/${menu.handle}`,
      }))}
    />
  );
}

function TaxonomiesFolder(props: SiteWideSectionProps) {
  const taxonomies = useTaxonomies();
  return (
    <SiteWideFolder
      {...props}
      folderKey="site:taxonomies"
      label="tree.taxonomies"
      icon={Tags}
      itemIcon={Tag}
      to="/content/taxonomies"
      items={taxonomies.data?.map((taxonomy) => ({
        key: `taxonomies:${taxonomy.handle}`,
        name: taxonomy.name,
        to: `/content/taxonomies/${taxonomy.handle}`,
      }))}
    />
  );
}
