import {
  type BoundItem,
  collectionListComponent,
  type DataCollection,
  entryFields,
  type ShopProduct,
} from "@lintel/builder-model";
import type { ReactNode } from "react";
import { drawsProps, type RenderMode } from "../component-registry.js";
import { ForItem, usePageData } from "../data-context.js";
import { cx } from "./behaviour-types.js";
import { gridClasses } from "./layout.js";

/**
 * A collection list: its children are the item design, drawn once per entry with that
 * entry as the current item, so bound elements show its fields. On the canvas the first
 * copy is the one people select and edit; the others follow it.
 */

/** An entry with each field's name in place of its value, for a list with nothing to show yet. */
export function placeholderItem(fields: DataCollection["fields"] = entryFields): BoundItem {
  return {
    id: "placeholder",
    fields: Object.fromEntries(
      fields.map((field) => [
        field.path,
        field.kind === "image"
          ? null
          : field.kind === "html"
            ? { html: `<p>${field.label}</p>` }
            : field.label,
      ]),
    ),
  };
}

export function Pagination({
  previousUrl,
  nextUrl,
  page,
  totalPages,
  mode,
}: {
  previousUrl: string | null;
  nextUrl: string | null;
  page: number;
  totalPages: number;
  mode: RenderMode;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="lintel-pagination" aria-label="More pages">
      {previousUrl ? (
        <a href={mode === "site" ? previousUrl : undefined} rel="prev">
          Previous
        </a>
      ) : (
        <span />
      )}
      <span className="lintel-pagination__where">
        Page {page} of {totalPages}
      </span>
      {nextUrl ? (
        <a href={mode === "site" ? nextUrl : undefined} rel="next">
          Next
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function RepeatedItems({
  items,
  mode,
  className,
  children,
  productFor,
}: {
  items: readonly BoundItem[];
  mode: RenderMode;
  className: string;
  children: ReactNode;
  /** In a product grid, the product each item is, for the shop elements inside. */
  productFor?: (item: BoundItem) => ShopProduct | undefined;
}) {
  return (
    <ul className={className}>
      {items.map((item, index) => {
        const isCopy = mode === "canvas" && index > 0;
        return (
          <li
            key={`${item.id}-${index}`}
            className="lintel-collection-list__item"
            aria-hidden={isCopy || undefined}
            data-lintel-repeat={isCopy ? "" : undefined}
          >
            <ForItem item={item} product={productFor?.(item)} isCopy={isCopy}>
              {children}
            </ForItem>
          </li>
        );
      })}
    </ul>
  );
}

const CollectionList = drawsProps(
  collectionListComponent,
  ({ props, attributes, node, children, mode }) => {
    const list = usePageData().lists?.[node.id];
    const items =
      list?.items ??
      (mode === "canvas" ? [placeholderItem(), placeholderItem(), placeholderItem()] : []);
    return (
      <div {...attributes} className={cx(attributes.className, "lintel-collection-list")}>
        {items.length === 0 ? (
          <p className="lintel-collection-list__empty">{props.emptyText}</p>
        ) : (
          <RepeatedItems
            items={items}
            mode={mode}
            className={cx(
              "lintel-grid",
              "lintel-grid--gap-medium",
              "lintel-collection-list__items",
              gridClasses(props),
            )}
          >
            {children}
          </RepeatedItems>
        )}
        {list && props.paginate && <Pagination {...list} mode={mode} />}
      </div>
    );
  },
);

export const collectionRenders = { collectionList: CollectionList };
