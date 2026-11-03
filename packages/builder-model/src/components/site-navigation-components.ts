import { z } from "zod";
import { nodeStylesSchema, type PageNode } from "../document/page-document.schema.js";
import { isSafeStyleValue } from "../styles/style-properties.js";
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

export const menuSourceField = {
  kind: "choice",
  prop: "menuSource",
  label: "Links",
  choices: [
    { value: "site", label: "A menu from Content → Menus" },
    { value: "custom", label: "Links I choose here" },
  ],
} as const;

/** Which of the site's menus (Content → Menus) an element shows: "main" unless chosen. */
export const menuHandleSchema = z
  .string({ error: "The menu should be named by its handle" })
  .max(64, { error: "A menu's handle is at most 64 characters" })
  .default("main");

/**
 * What a Menu link does while the pointer is over it (or it has keyboard focus): nothing
 * more than its Hovered look, a line drawn in under it, the words rolling up, the letters
 * scrambling, a thin circle drawn around it, or its colour fading to another.
 */
export const menuLinkHoverLooks = [
  "none",
  "underline",
  "rollUp",
  "scramble",
  "circle",
  "colour",
] as const;
export type MenuLinkHoverLook = (typeof menuLinkHoverLooks)[number];

/** A menu item's id, as `data-menu-item` carries it and per-link looks are keyed by. */
export const menuItemIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, {
  error: "A menu item should be named by its id",
});

/**
 * The look of every link in a Menu, as one element inside it (see menu-links/). Its words
 * and addresses still come from the menu; this only says how they look: its own styles,
 * hovered and current looks, a hover effect, and a few links changed on their own
 * (`itemStyles`, by menu item id), which keep the rest of the shared look.
 */
export const menuLinkComponent = defineComponent({
  type: "menuLink",
  label: "Menu link",
  keywords: ["link", "menu item"],
  description: "How every link in its menu looks. The words and addresses come from the menu.",
  icon: "link",
  category: "navigation",
  propsSchema: z.object({
    hoverLook: oneOf(menuLinkHoverLooks, "What a link does on hover"),
    lookColour: z
      .string()
      .max(120)
      .refine((value) => value === "" || isSafeStyleValue(value), {
        error: "That colour can’t be used",
      })
      .default(""),
    keepOnCurrent: z.boolean().default(true),
    itemStyles: z
      .record(menuItemIdSchema, nodeStylesSchema)
      .refine((looks) => Object.keys(looks).length <= 50, {
        error: "At most 50 links can have looks of their own",
      })
      .default({}),
  }),
  defaultProps: { hoverLook: "none", lookColour: "", keepOnCurrent: true, itemStyles: {} },
  allowedChildren: "none",
  allowedParents: ["navigation"],
  hiddenFromInsert: true,
  editableFields: [
    {
      kind: "choice",
      prop: "hoverLook",
      label: "When a link is hovered",
      choices: [
        { value: "none", label: "Only its Hovered look" },
        { value: "underline", label: "A line draws in under it" },
        { value: "rollUp", label: "The words roll up" },
        { value: "scramble", label: "The letters scramble" },
        { value: "circle", label: "A circle draws around it" },
        { value: "colour", label: "Its colour fades" },
      ],
    },
    { kind: "text", prop: "lookColour", label: "Colour" },
    { kind: "toggle", prop: "keepOnCurrent", label: "Keep it on the current page’s link" },
  ],
});

export const siteHeaderComponent = defineComponent({
  type: "siteHeader",
  label: "Header",
  keywords: ["navbar", "nav", "top bar"],
  description:
    "Your logo and menu across the top. Menu items can open big menus with columns and a featured picture; on phones it becomes a menu button.",
  icon: "panel-top",
  category: "navigation",
  propsSchema: z.object({
    menuSource: oneOf(["site", "custom"], "Where the menu comes from"),
    menuHandle: menuHandleSchema,
    items: itemsOf(menuItemSchema, 12, "menu items").default([]),
    logo: pictureSchema.default(emptyPicture),
    showSiteName: z.boolean().default(true),
    buttonLabel: plainText(80),
    buttonHref: linkAddressSchema.default(""),
    sticks: z.boolean().default(false),
  }),
  defaultProps: {
    menuSource: "site",
    menuHandle: "main",
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

/**
 * The site's logo, or its name, linking to the home page: the start of most navigation
 * sections. Both follow the site's own (Settings → Website and Site settings), so a new
 * logo shows everywhere at once.
 */
export const siteLogoComponent = defineComponent({
  type: "siteLogo",
  label: "Site logo",
  keywords: ["brand", "logo", "site name", "home link"],
  description: "Your logo or your site's name, linking to the home page.",
  icon: "house",
  category: "navigation",
  propsSchema: z.object({
    shows: oneOf(["both", "logo", "name"], "What it shows"),
  }),
  defaultProps: { shows: "both" },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "choice",
      prop: "shows",
      label: "Shows",
      choices: [
        { value: "both", label: "The logo and the name" },
        { value: "logo", label: "Only the logo" },
        { value: "name", label: "Only the name" },
      ],
    },
  ],
});

export const mobileMenuComponent = defineComponent({
  type: "mobileMenu",
  label: "Menu drawer",
  keywords: ["hamburger", "nav", "drawer"],
  description: "A menu button that slides a panel of links in from the side. Handy on phones.",
  icon: "panel-left-open",
  category: "navigation",
  propsSchema: z.object({
    menuSource: oneOf(["site", "custom"], "Where the menu comes from"),
    menuHandle: menuHandleSchema,
    links: itemsOf(linkSchema, 40, "links").default([]),
    buttonLabel: plainText(60, "Menu"),
    side: oneOf(["right", "left"], "The side it opens from"),
    onlyOnSmallScreens: z.boolean().default(true),
  }),
  defaultProps: {
    menuSource: "site",
    menuHandle: "main",
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
  keywords: ["bottom"],
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
  keywords: ["translation", "language"],
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
  keywords: ["search"],
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
  keywords: ["scroll to top", "up arrow"],
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

/**
 * A "Cookie settings" link that opens the site's cookie notice again, so visitors can change
 * their mind. It shows only on sites that have the notice (see core's src/cookie-notice).
 */
export const cookieSettingsComponent = defineComponent({
  type: "cookieSettings",
  label: "Cookie settings",
  keywords: ["cookies", "privacy", "consent", "gdpr"],
  description:
    "A link that lets visitors change their cookie choices. It only shows when your site asks about cookies.",
  icon: "cookie",
  category: "navigation",
  propsSchema: z.object({ label: plainText(60, "Cookie settings") }),
  defaultProps: { label: "Cookie settings" },
  allowedChildren: "none",
  editableFields: [{ kind: "text", prop: "label", label: "Words" }],
});

/**
 * Where an element belongs on a page when it's added from Insert, whatever is selected:
 * the Header, and sections drawn as the page's header, at the very top; the Footer, and
 * sections drawn as the page's footer (the footer templates), at the very bottom. Null for
 * everything else.
 */
export function pageEdgeFor(element: {
  type: string;
  props?: Readonly<Record<string, unknown>>;
}): "top" | "bottom" | null {
  if (element.type === "siteHeader") return "top";
  if (element.type === "section" && element.props?.element === "header") return "top";
  if (element.type === "siteFooter") return "bottom";
  if (element.type === "section" && element.props?.element === "footer") return "bottom";
  return null;
}

/**
 * The ids the site's own navigation and footer sections have while a page is being edited
 * (see site-sections/). They are the site's, not the page's own.
 */
export const siteSectionIds: ReadonlySet<string> = new Set(["site-navigation", "site-footer"]);

/**
 * Whether a page brings its own header and footer, so the website (and the canvas) leaves
 * out the site's own: a visible Header or Footer element anywhere, or a header or footer
 * section at the top level of the page. A header section used to be ignored, so a page
 * with its own nav showed the site's above it as well. The site's shared navigation and
 * footer, put into the page while it is edited, are not the page's own.
 */
export function ownSiteChrome(root: PageNode): { header: boolean; footer: boolean } {
  const own = root.children.filter((child) => !child.hidden && !siteSectionIds.has(child.id));
  let header = own.some((child) => pageEdgeFor(child) === "top");
  let footer = own.some((child) => pageEdgeFor(child) === "bottom");
  const visit = (node: PageNode) => {
    if (node.hidden || siteSectionIds.has(node.id)) return;
    if (node.type === "siteHeader") header = true;
    if (node.type === "siteFooter") footer = true;
    node.children.forEach(visit);
  };
  visit(root);
  return { header, footer };
}
