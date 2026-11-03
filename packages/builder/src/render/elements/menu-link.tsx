import { menuLinkComponent } from "@lintel/builder-model";
import { createContext, use } from "react";
import { drawsProps } from "../component-registry.js";
import { cx } from "./behaviour-types.js";

/**
 * A Menu's links, drawn by its Menu link (see menu-links/ in the model): each link carries
 * the Menu link's class, so one look styles them all, and `data-menu-item`, so a link
 * changed on its own can be told apart. On the canvas every link selects the Menu link.
 */

export interface MenuLinkEntry {
  /** The menu item's id (see `menuItemKey`). */
  id: string;
  label: string;
  href: string;
  isButton: boolean;
  current: boolean;
}

/** The links the Menu around a Menu link shows. */
export const MenuLinksContext = createContext<readonly MenuLinkEntry[]>([]);

/** The words, and for "roll up" a copy below them, hidden from screen readers. */
function Words({ label, rolls }: { label: string; rolls: boolean }) {
  if (!rolls) return <>{label}</>;
  return (
    <span className="lintel-roll">
      <span className="lintel-roll__words">{label}</span>
      <span className="lintel-roll__copy" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}

export const MenuLink = drawsProps(menuLinkComponent, ({ props, attributes }) => {
  const links = use(MenuLinksContext);
  const rolls = props.hoverLook === "rollUp";
  return (
    <>
      {links.map((link) => (
        <li key={link.id}>
          <a
            {...attributes}
            className={cx(attributes.className, link.isButton && "lintel-button")}
            href={link.href || undefined}
            aria-current={link.current ? "page" : undefined}
            data-menu-item={link.id}
          >
            <Words label={link.label} rolls={rolls} />
          </a>
        </li>
      ))}
    </>
  );
});
