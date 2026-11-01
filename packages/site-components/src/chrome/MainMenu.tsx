import { newTabAttributes } from "../blocks/Button.js";
import type { MenuItem } from "../site.types.js";

export interface MainMenuProps {
  items: readonly MenuItem[];
  /** The menu's accessible name, "Main menu". */
  label: string;
}

/**
 * The site's main menu. Output: `<nav aria-label><ul class="lintel-menu">` of
 * `<li class="lintel-menu__item">`. An item with items inside it is a `<details>`
 * disclosure, so its sub-menu opens by click, tap or keyboard without any script; when the
 * item is itself a page, that page is the first link inside.
 */
export function MainMenu({ items, label }: MainMenuProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <nav className="lintel-menu-bar" aria-label={label}>
      <ul className="lintel-menu">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="lintel-menu__item">
            {item.children.length > 0 ? <MenuGroup item={item} /> : <MenuLink item={item} />}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MenuLink({
  item,
  className = "lintel-menu__link",
}: {
  item: MenuItem;
  className?: string;
}) {
  if (item.url === null) {
    return <span className={className}>{item.label}</span>;
  }
  return (
    <a
      className={className}
      href={item.url}
      aria-current={item.current ? "page" : undefined}
      {...newTabAttributes(item.newTab)}
    >
      {item.label}
    </a>
  );
}

function MenuGroup({ item }: { item: MenuItem }) {
  const containsCurrent = item.current || item.children.some((child) => child.current);
  const links = item.url === null ? item.children : [{ ...item, children: [] }, ...item.children];
  return (
    <details className="lintel-menu__group">
      <summary className="lintel-menu__link" data-current={containsCurrent ? "true" : undefined}>
        {item.label}
      </summary>
      <ul className="lintel-menu__submenu">
        {links.map((child, index) => (
          <li key={`${index}-${child.label}`}>
            <MenuLink item={child} className="lintel-menu__sublink" />
          </li>
        ))}
      </ul>
    </details>
  );
}
