import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import { oneOf, plainText, wholeNumber } from "./component-props.js";

/**
 * The shop's elements, offered while the Online shop plugin is on. Each shows "the current
 * product": the one chosen in its Content panel, the product a product page is for, or
 * the item of a product grid it sits in. Buying goes through the storefront API: the cart
 * lives in the visitor's browser by its token, and checkout hands over to the payment
 * provider the shop uses.
 */

const productHandleSchema = z
  .string()
  .regex(/^([a-z0-9][a-z0-9_-]{0,127})?$/, { error: "A product should be chosen by its handle" })
  .default("");

const productField = {
  kind: "source",
  source: "products",
  prop: "product",
  label: "Product (leave empty for the page’s own product)",
} as const;

export const productCardComponent = defineComponent({
  type: "productCard",
  label: "Product card",
  description: "A product’s picture, name and price, linking to its page.",
  icon: "shopping-bag",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    product: productHandleSchema,
    showAddToCart: z.boolean().default(false),
    imageShape: oneOf(["portrait", "square", "landscape"], "The picture’s shape"),
  }),
  defaultProps: { product: "", showAddToCart: false, imageShape: "portrait" },
  allowedChildren: "none",
  editableFields: [
    productField,
    { kind: "toggle", prop: "showAddToCart", label: "Show an Add to basket button" },
    {
      kind: "choice",
      prop: "imageShape",
      label: "Picture shape",
      choices: [
        { value: "portrait", label: "Tall" },
        { value: "square", label: "Square" },
        { value: "landscape", label: "Wide" },
      ],
      advanced: true,
    },
  ],
});

export const productGridSorts = [
  "featured",
  "newest",
  "priceLowToHigh",
  "priceHighToLow",
  "titleAToZ",
] as const;

export const productGridComponent = defineComponent({
  type: "productGrid",
  label: "Product grid",
  description:
    "Products from your shop, or from one of its collections, in a grid. Visitors can sort them.",
  icon: "store",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    collection: productHandleSchema,
    sort: oneOf(productGridSorts, "The order"),
    limit: wholeNumber(1, 100, 12),
    paginate: z.boolean().default(true),
    showSort: z.boolean().default(true),
    columns: wholeNumber(1, 6, 4),
    tabletColumns: wholeNumber(1, 6, 2),
    phoneColumns: wholeNumber(1, 6, 2),
    emptyText: plainText(300, "No products here yet."),
  }),
  defaultProps: {
    collection: "",
    sort: "featured",
    limit: 12,
    paginate: true,
    showSort: true,
    columns: 4,
    tabletColumns: 2,
    phoneColumns: 2,
    emptyText: "No products here yet.",
  },
  defaultChildren: [{ type: "productCard", name: "Item design" }],
  allowedChildren: "any",
  editableFields: [
    {
      kind: "source",
      source: "productCollections",
      prop: "collection",
      label: "Products from (leave empty for all)",
    },
    {
      kind: "choice",
      prop: "sort",
      label: "Order",
      choices: [
        { value: "featured", label: "The shop’s own order" },
        { value: "newest", label: "Newest first" },
        { value: "priceLowToHigh", label: "Price, low to high" },
        { value: "priceHighToLow", label: "Price, high to low" },
        { value: "titleAToZ", label: "By name, A to Z" },
      ],
    },
    { kind: "number", prop: "limit", label: "How many on a page", min: 1, max: 100 },
    { kind: "toggle", prop: "showSort", label: "Let visitors change the order" },
    {
      kind: "toggle",
      prop: "paginate",
      label: "Link to more pages when there are more",
      advanced: true,
    },
    ...(["columns", "tabletColumns", "phoneColumns"] as const).map((prop) => ({
      kind: "choice" as const,
      prop,
      label: {
        columns: "Columns on computers",
        tabletColumns: "Columns on tablets",
        phoneColumns: "Columns on phones",
      }[prop],
      choices: [1, 2, 3, 4, 5, 6].map((count) => ({ value: String(count), label: String(count) })),
      advanced: true,
    })),
    {
      kind: "multilineText",
      prop: "emptyText",
      label: "What to say when there are none",
      advanced: true,
    },
  ],
});

export const productGalleryComponent = defineComponent({
  type: "productGallery",
  label: "Product pictures",
  description: "The product’s pictures: a big one, with small ones to choose from.",
  icon: "images",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    product: productHandleSchema,
    thumbnails: oneOf(["below", "side", "none"], "Where the small pictures go"),
  }),
  defaultProps: { product: "", thumbnails: "below" },
  allowedChildren: "none",
  editableFields: [
    productField,
    {
      kind: "choice",
      prop: "thumbnails",
      label: "Small pictures",
      choices: [
        { value: "below", label: "Underneath" },
        { value: "side", label: "Beside it" },
        { value: "none", label: "None, swipe between pictures" },
      ],
    },
  ],
});

export const productPriceComponent = defineComponent({
  type: "productPrice",
  label: "Price",
  description: "The product’s price, with the old price crossed out when it’s on sale.",
  icon: "badge-pound-sterling",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    product: productHandleSchema,
    showSaving: z.boolean().default(true),
  }),
  defaultProps: { product: "", showSaving: true },
  allowedChildren: "none",
  editableFields: [
    productField,
    { kind: "toggle", prop: "showSaving", label: "Show how much is saved" },
  ],
});

export const variantPickerComponent = defineComponent({
  type: "variantPicker",
  label: "Options picker",
  description: "Lets shoppers choose a size, colour or other option before adding to the basket.",
  icon: "sliders-horizontal",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    product: productHandleSchema,
    look: oneOf(["buttons", "menus"], "The look"),
  }),
  defaultProps: { product: "", look: "buttons" },
  allowedChildren: "none",
  editableFields: [
    productField,
    {
      kind: "choice",
      prop: "look",
      label: "Look",
      choices: [
        { value: "buttons", label: "Buttons" },
        { value: "menus", label: "Drop-down menus" },
      ],
    },
  ],
});

export const addToCartComponent = defineComponent({
  type: "addToCart",
  label: "Add to basket",
  description: "The button that puts the product in the basket, with a quantity box.",
  icon: "shopping-cart",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    product: productHandleSchema,
    label: plainText(60, "Add to basket"),
    soldOutLabel: plainText(60, "Sold out"),
    showQuantity: z.boolean().default(true),
    opensCart: z.boolean().default(true),
  }),
  defaultProps: {
    product: "",
    label: "Add to basket",
    soldOutLabel: "Sold out",
    showQuantity: true,
    opensCart: true,
  },
  allowedChildren: "none",
  editableFields: [
    productField,
    { kind: "text", prop: "label", label: "Words on the button" },
    { kind: "toggle", prop: "showQuantity", label: "Show a quantity box" },
    { kind: "toggle", prop: "opensCart", label: "Open the basket after adding" },
    { kind: "text", prop: "soldOutLabel", label: "Words when sold out", advanced: true },
  ],
});

export const cartDrawerComponent = defineComponent({
  type: "cartDrawer",
  label: "Basket button",
  description: "A basket icon with the number of items. It opens the basket from the side.",
  icon: "shopping-basket",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    label: plainText(60, "Basket"),
    emptyText: plainText(200, "Your basket is empty."),
    checkoutLabel: plainText(60, "Check out"),
  }),
  defaultProps: { label: "Basket", emptyText: "Your basket is empty.", checkoutLabel: "Check out" },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "label", label: "Name" },
    { kind: "text", prop: "emptyText", label: "Words when it’s empty" },
    { kind: "text", prop: "checkoutLabel", label: "Words on the checkout button", advanced: true },
  ],
});

export const cartContentsComponent = defineComponent({
  type: "cartContents",
  label: "Basket",
  description:
    "Everything in the basket, with quantities, the total and the checkout button. For the basket page.",
  icon: "shopping-cart",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    emptyText: plainText(200, "Your basket is empty."),
    continueLabel: plainText(60, "Keep shopping"),
    continueHref: z.string().max(200).default("/shop"),
  }),
  defaultProps: {
    emptyText: "Your basket is empty.",
    continueLabel: "Keep shopping",
    continueHref: "/shop",
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "emptyText", label: "Words when it’s empty" },
    { kind: "text", prop: "continueLabel", label: "Words on the keep-shopping link" },
    { kind: "link", prop: "continueHref", label: "Keep shopping goes to", advanced: true },
  ],
});

export const checkoutButtonComponent = defineComponent({
  type: "checkoutButton",
  label: "Checkout button",
  description: "Takes shoppers to pay for their basket, with the payment provider your shop uses.",
  icon: "credit-card",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({ label: plainText(60, "Check out") }),
  defaultProps: { label: "Check out" },
  allowedChildren: "none",
  editableFields: [{ kind: "text", prop: "label", label: "Words on the button" }],
});

export const orderConfirmationComponent = defineComponent({
  type: "orderConfirmation",
  label: "Order confirmation",
  description: "Thanks the shopper and shows their order number once the payment arrives.",
  icon: "circle-check",
  category: "shop",
  requiresPlugin: "commerce",
  propsSchema: z.object({
    title: plainText(200, "Thank you for your order"),
    waitingText: plainText(300, "We’re confirming your payment. This takes a few seconds."),
    doneText: plainText(300, "Your order number is {order}. We’ve sent the details to your email."),
  }),
  defaultProps: {
    title: "Thank you for your order",
    waitingText: "We’re confirming your payment. This takes a few seconds.",
    doneText: "Your order number is {order}. We’ve sent the details to your email.",
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "title", label: "Title" },
    { kind: "multilineText", prop: "waitingText", label: "While the payment is checked" },
    {
      kind: "multilineText",
      prop: "doneText",
      label: "Once it’s paid ({order} is the order number)",
    },
  ],
});
