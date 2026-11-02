import { ChevronDown } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { menuItemLabel } from "./MenuItemRow.js";
import { buildMenu, type FlatMenuItem } from "./menuTree.js";
import type { LinkedEntry, MenuItem } from "./menus.types.js";

/**
 * How the menu looks on a site, as it is being edited: the top level as a bar, drop-downs
 * listed under their item, buttons as buttons. Pages that aren't published yet are shown
 * faded, since visitors won't see them until they are. It is a picture, so screen readers
 * get the list itself instead.
 */
export function MenuPreview({
  items,
  linkedEntries,
}: {
  items: readonly FlatMenuItem[];
  linkedEntries: Record<string, LinkedEntry>;
}) {
  const tree = buildMenu(items);
  return (
    <section aria-labelledby="menu-preview-title" className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-1">
        <h2 id="menu-preview-title" className="text-footnote font-semibold text-label">
          {t("menus.preview")}
        </h2>
        <p className="text-caption text-label-secondary">{t("menus.preview.description")}</p>
      </div>
      <div className="rounded-card bg-surface px-4 py-3 hairline-ring">
        {tree.length === 0 ? (
          <p className="text-footnote text-label-tertiary">{t("menus.preview.empty")}</p>
        ) : (
          <ul className="flex flex-wrap items-start gap-x-1 gap-y-2">
            {tree.map((item) => (
              <PreviewItem key={item.id} item={item} linkedEntries={linkedEntries} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PreviewItem({
  item,
  linkedEntries,
}: {
  item: MenuItem;
  linkedEntries: Record<string, LinkedEntry>;
}) {
  const linked = item.entryId ? linkedEntries[item.entryId] : undefined;
  const label = menuItemLabel({ ...item, depth: 0 }, linked);
  const isDraft = linked !== undefined && linked.status !== "published";
  const title = isDraft ? t("menus.preview.draft", { label }) : label;
  return (
    <li className="flex flex-col">
      <span
        title={title}
        className={classNames(
          "inline-flex h-8 items-center gap-1 rounded-control px-3 text-footnote",
          item.style === "button"
            ? "ms-2 bg-accent-fill font-semibold text-on-accent"
            : "font-medium text-label",
          isDraft && "opacity-45",
        )}
      >
        {label}
        {item.children.length > 0 && (
          <ChevronDown aria-hidden="true" strokeWidth={2} className="size-3.5" />
        )}
      </span>
      {item.children.length > 0 && (
        <ul className="ms-3 flex flex-col border-s border-separator ps-2 text-caption text-label-secondary">
          {item.children.map((child) => (
            <li key={child.id} className="py-0.5">
              {menuItemLabel(
                { ...child, depth: 1 },
                child.entryId ? linkedEntries[child.entryId] : undefined,
              )}
              {child.children.length > 0 && ` (+${child.children.length})`}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
