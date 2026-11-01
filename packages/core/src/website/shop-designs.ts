import {
  createComponentCatalogue,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  pageDocumentVersion,
  rootNodeId,
  standardComponents,
} from "@lintel/builder-model";

/**
 * The designs the built-in website gives the shop's pages until the site makes its own:
 * all products, a collection, a product, the basket and the order confirmation. A
 * published page that is the item design for "Products in the shop" replaces the product
 * page's design.
 */

const catalogue = createComponentCatalogue([...standardComponents]);

function shopTopBar(title: string): NodeBlueprint {
  return {
    type: "box",
    name: "Shop bar",
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--lintel-space-4)",
      },
    },
    children: [{ type: "heading", props: { text: title, level: 1 } }, { type: "cartDrawer" }],
  };
}

function page(children: readonly NodeBlueprint[]): PageDocument {
  let counter = 0;
  const createId = () => `shop${(counter += 1)}`;
  const section = createNode(
    { type: "section", children: [{ type: "container", children }] },
    catalogue,
    createId,
  );
  return {
    version: pageDocumentVersion,
    root: {
      id: rootNodeId,
      type: "page",
      name: "",
      props: { itemDesignFor: "" },
      styles: { base: {} },
      children: [section],
      hidden: false,
      locked: false,
    },
  };
}

export function allProductsDesign(title: string): PageDocument {
  return page([shopTopBar(title), { type: "productGrid" }]);
}

export function productCollectionDesign(title: string, description: string): PageDocument {
  return page([
    shopTopBar(title),
    ...(description ? [{ type: "text", props: { text: description } }] : []),
    { type: "productGrid" },
  ]);
}

export function productDesign(): PageDocument {
  return page([
    {
      type: "box",
      name: "Shop bar",
      styles: {
        base: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
      },
      children: [
        {
          type: "breadcrumbs",
          props: { links: [{ label: "Shop", href: "/shop" }], current: "" },
          bindings: { current: "title" },
        },
        { type: "cartDrawer" },
      ],
    },
    {
      type: "columns",
      children: [
        { type: "box", name: "Pictures", children: [{ type: "productGallery" }] },
        {
          type: "box",
          name: "Details",
          children: [
            { type: "heading", props: { text: "Product", level: 1 }, bindings: { text: "title" } },
            { type: "productPrice" },
            { type: "variantPicker" },
            { type: "addToCart" },
            { type: "richText", props: { markdown: "" }, bindings: { markdown: "body" } },
          ],
        },
      ],
    },
  ]);
}

export function cartDesign(): PageDocument {
  return page([
    { type: "heading", props: { text: "Your basket", level: 1 } },
    { type: "cartContents" },
  ]);
}

export function orderConfirmationDesign(): PageDocument {
  return page([{ type: "orderConfirmation" }]);
}
