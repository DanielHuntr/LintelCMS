import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import {
  emptyPicture,
  itemsOf,
  linkAddressSchema,
  linkSchema,
  oneOf,
  pictureSchema,
  plainText,
} from "./component-props.js";

/**
 * A site's header, menus and footer, and the small helpers around them: a language
 * switcher, a search box and a "back to top" link. Menus can follow the site's main menu
 * (Settings → Menus), so a change there shows everywhere.
 */

const menuItemSchema = z.object({
  label: plainText(100),
  href: linkAddressSchema.default(""),
  columnOneTitle: plainText(100),
  columnOneLinks: itemsOf(linkSchema, 12, "links").default([]),
  columnTwoTitle: plainText(100),
  columnTwoLinks: itemsOf(linkSchema, 12, "links").default([]),
  columnThreeTitle: plainText(100),
  columnThreeLinks: itemsOf(linkSchema, 12, "links").default([]),
  featuredImage: pictureSchema.default(emptyPicture),
  featuredTitle: plainText(200),
  featuredHref: linkAddressSchema.default(""),
});

export type MegaMenuItem = z.output<typeof menuItemSchema>;

const newMenuItem: MegaMenuItem = {
  label: "New link",
  href: "",
  columnOneTitle: "",
  columnOneLinks: [],
  columnTwoTitle: "",
  columnTwoLinks: [],
  columnThreeTitle: "",
  columnThreeLinks: [],
  featuredImage: emptyPicture,
  featuredTitle: "",
  featuredHref: "",
};

const menuSourceField = {
  kind: "choice",
  prop: "menuSource",
  label: "Links",
  choices: [
    { value: "site", label: "The site’s main menu" },
    { value: "custom", label: "Links I choose here" },
  ],
} as const;

export const siteHeaderComponent = defineComponent({
  type: "siteHeader",
  label: "Header",
  description:
    "Your logo and menu across the top. Menu items can open big menus with columns and a featured picture; on phones it becomes a menu button.",
  icon: "panel-top",
  category: "navigation",
  propsSchema: z.object({
    menuSource: oneOf(["site", "custom"], "Where the menu comes from"),
    items: itemsOf(menuItemSchema, 12, "menu items").default([]),
    logo: pictureSchema.default(emptyPicture),
    showSiteName: z.boolean().default(true),
    buttonLabel: plainText(80),
    buttonHref: linkAddressSchema.default(""),
    sticks: z.boolean().default(false),
  }),
  defaultProps: {
    menuSource: "site",
    items: [],
    logo: emptyPicture,
    showSiteName: true,
    buttonLabel: "",
    buttonHref: "",
    sticks: false,
  },
  allowedChildren: "none",
  editableFields: [
    menuSourceField,
    {
      kind: "itemList",
      prop: "items",
      label: "Menu items",
      itemLabel: "Menu item",
      titleField: "label",
      maxItems: 12,
      newItem: newMenuItem,
      fields: [
        { kind: "text", prop: "label", label: "Words" },
        { kind: "link", prop: "href", label: "Goes to (leave empty to only open the big menu)" },
        { kind: "text", prop: "columnOneTitle", label: "First column’s title" },
        { kind: "linkList", prop: "columnOneLinks", label: "First column’s links" },
        { kind: "text", prop: "columnTwoTitle", label: "Second column’s title" },
        { kind: "linkList", prop: "columnTwoLinks", label: "Second column’s links" },
        { kind: "text", prop: "columnThreeTitle", label: "Third column’s title" },
        { kind: "linkList", prop: "columnThreeLinks", label: "Third column’s links" },
        { kind: "image", prop: "featuredImage", label: "Featured picture" },
        { kind: "text", prop: "featuredTitle", label: "Featured title" },
        { kind: "link", prop: "featuredHref", label: "Featured link" },
      ],
    },
    { kind: "image", prop: "logo", label: "Logo (leave empty for the site’s own)" },
    { kind: "toggle", prop: "showSiteName", label: "Show the site’s name" },
    { kind: "text", prop: "buttonLabel", label: "Button words (optional)" },
    { kind: "link", prop: "buttonHref", label: "Button goes to" },
    { kind: "toggle", prop: "sticks", label: "Stay at the top while scrolling", advanced: true },
  ],
});

export const mobileMenuComponent = defineComponent({
  type: "mobileMenu",
  label: "Menu drawer",
  description: "A menu button that slides a panel of links in from the side. Handy on phones.",
  icon: "panel-left-open",
  category: "navigation",
  propsSchema: z.object({
    menuSource: oneOf(["site", "custom"], "Where the menu comes from"),
    links: itemsOf(linkSchema, 40, "links").default([]),
    buttonLabel: plainText(60, "Menu"),
    side: oneOf(["right", "left"], "The side it opens from"),
    onlyOnSmallScreens: z.boolean().default(true),
  }),
  defaultProps: {
    menuSource: "site",
    links: [],
    buttonLabel: "Menu",
    side: "right",
    onlyOnSmallScreens: true,
  },
  allowedChildren: "none",
  editableFields: [
    menuSourceField,
    { kind: "linkList", prop: "links", label: "Links I choose" },
    { kind: "text", prop: "buttonLabel", label: "Words on the button" },
    {
      kind: "choice",
      prop: "side",
      label: "Opens from",
      choices: [
        { value: "right", label: "The right" },
        { value: "left", label: "The left" },
      ],
      advanced: true,
    },
    {
      kind: "toggle",
      prop: "onlyOnSmallScreens",
      label: "Only on phones and tablets",
      advanced: true,
    },
  ],
});

const footerColumnSchema = z.object({
  title: plainText(100),
  links: itemsOf(linkSchema, 20, "links").default([]),
});

export const siteFooterComponent = defineComponent({
  type: "siteFooter",
  label: "Footer",
  description: "Columns of links along the bottom, with your small print and social links.",
  icon: "panel-bottom",
  category: "navigation",
  propsSchema: z.object({
    columns: itemsOf(footerColumnSchema, 6, "columns").default([]),
    smallPrint: plainText(500),
    showSocialLinks: z.boolean().default(true),
    showLanguages: z.boolean().default(true),
  }),
  defaultProps: {
    columns: [
      {
        title: "Shop",
        links: [
          { label: "All products", href: "/shop" },
          { label: "Delivery", href: "/delivery" },
        ],
      },
      {
        title: "About",
        links: [
          { label: "Our story", href: "/about" },
          { label: "Contact", href: "/contact" },
        ],
      },
    ],
    smallPrint: "",
    showSocialLinks: true,
    showLanguages: true,
  },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "itemList",
      prop: "columns",
      label: "Columns",
      itemLabel: "Column",
      titleField: "title",
      maxItems: 6,
      newItem: { title: "New column", links: [] },
      fields: [
        { kind: "text", prop: "title", label: "Title" },
        { kind: "linkList", prop: "links", label: "Links" },
      ],
    },
    {
      kind: "text",
      prop: "smallPrint",
      label: "Small print (leave empty for © and the site’s name)",
    },
    { kind: "toggle", prop: "showSocialLinks", label: "Show the site’s social links" },
    {
      kind: "toggle",
      prop: "showLanguages",
      label: "Show links to other languages",
      advanced: true,
    },
  ],
});

export const languageSwitcherComponent = defineComponent({
  type: "languageSwitcher",
  label: "Language switcher",
  description: "Lets visitors read this page in the site’s other languages.",
  icon: "languages",
  category: "navigation",
  propsSchema: z.object({
    look: oneOf(["links", "menu"], "The look"),
    label: plainText(60, "Language"),
  }),
  defaultProps: { look: "links", label: "Language" },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "choice",
      prop: "look",
      label: "Look",
      choices: [
        { value: "links", label: "A row of links" },
        { value: "menu", label: "A drop-down menu" },
      ],
    },
    { kind: "text", prop: "label", label: "Name for screen readers", advanced: true },
  ],
});

export const searchBoxComponent = defineComponent({
  type: "searchBox",
  label: "Search box",
  description: "A box visitors type in to search your site.",
  icon: "search",
  category: "navigation",
  propsSchema: z.object({
    label: plainText(80, "Search this site"),
    placeholder: plainText(80, "What are you looking for?"),
    buttonLabel: plainText(40, "Search"),
  }),
  defaultProps: {
    label: "Search this site",
    placeholder: "What are you looking for?",
    buttonLabel: "Search",
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "label", label: "Label" },
    { kind: "text", prop: "placeholder", label: "Hint inside the box" },
    { kind: "text", prop: "buttonLabel", label: "Words on the button", advanced: true },
  ],
});

export const backToTopComponent = defineComponent({
  type: "backToTop",
  label: "Back to top",
  description: "A button that takes visitors back to the top of a long page.",
  icon: "arrow-up-to-line",
  category: "navigation",
  propsSchema: z.object({
    label: plainText(60, "Back to top"),
    floats: z.boolean().default(true),
  }),
  defaultProps: { label: "Back to top", floats: true },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "label", label: "Words" },
    { kind: "toggle", prop: "floats", label: "Float in the corner once visitors scroll down" },
  ],
});
