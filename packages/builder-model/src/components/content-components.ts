import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import { marksFitText, textMarksSchema } from "../text-marks/text-marks.js";
import {
  imageAddressSchema,
  linkAddressSchema,
  linkSchema,
  oneOf,
  plainText,
} from "./component-props.js";
import { menuHandleSchema, menuSourceField } from "./site-navigation-components.js";

const marksFitError = { error: "Styled parts of the text should sit inside it, one after another" };

/** Text, pictures, buttons and links: the elements people fill in. */

export const headingComponent = defineComponent({
  type: "heading",
  label: "Heading",
  description: "A title for the page or for a part of it. Use one main heading per page.",
  icon: "heading",
  category: "text",
  propsSchema: z
    .object({
      text: plainText(500, "Heading"),
      level: z
        .number({ error: "A heading level should be a number from 1 to 6" })
        .int()
        .min(1, { error: "A heading level should be a number from 1 to 6" })
        .max(6, { error: "A heading level should be a number from 1 to 6" })
        .default(2),
      // Styles on part of the text (see text-marks/); left out when there are none.
      marks: textMarksSchema,
    })
    .refine(marksFitText, marksFitError),
  defaultProps: { text: "Heading", level: 2 },
  allowedChildren: "none",
  editableFields: [
    { kind: "multilineText", prop: "text", label: "Text" },
    {
      kind: "choice",
      prop: "level",
      label: "Importance",
      choices: [
        { value: "1", label: "Main page title (H1)" },
        { value: "2", label: "Section title (H2)" },
        { value: "3", label: "Subtitle (H3)" },
        { value: "4", label: "Small title (H4)" },
        { value: "5", label: "Smaller title (H5)" },
        { value: "6", label: "Smallest title (H6)" },
      ],
    },
  ],
});

export const textComponent = defineComponent({
  type: "text",
  label: "Paragraph",
  description: "A paragraph of text.",
  icon: "pilcrow",
  category: "text",
  propsSchema: z
    .object({ text: plainText(10000, "Write something here."), marks: textMarksSchema })
    .refine(marksFitText, marksFitError),
  defaultProps: { text: "Write something here." },
  allowedChildren: "none",
  editableFields: [{ kind: "multilineText", prop: "text", label: "Text" }],
});

export const quoteComponent = defineComponent({
  type: "quote",
  label: "Quote",
  description: "Words from someone else, such as a customer review, with who said them.",
  icon: "quote",
  category: "text",
  propsSchema: z.object({
    text: plainText(2000, "A short, kind word from a happy customer."),
    citation: plainText(200),
  }),
  defaultProps: { text: "A short, kind word from a happy customer.", citation: "" },
  allowedChildren: "none",
  editableFields: [
    { kind: "multilineText", prop: "text", label: "Quote" },
    { kind: "text", prop: "citation", label: "Who said it", placeholder: "Sam, a customer" },
  ],
});

export const listComponent = defineComponent({
  type: "list",
  label: "List",
  description: "Points one under another, with bullets or numbers.",
  icon: "list",
  category: "text",
  propsSchema: z.object({
    items: z
      .array(plainText(1000), { error: "A list’s items should be a list of text" })
      .max(200, { error: "A list can have at most 200 items" })
      .default(["First point", "Second point"]),
    ordered: z.boolean({ error: "ordered should be true or false" }).default(false),
  }),
  defaultProps: { items: ["First point", "Second point"], ordered: false },
  allowedChildren: "none",
  editableFields: [
    { kind: "textList", prop: "items", label: "Points", itemLabel: "Point" },
    { kind: "toggle", prop: "ordered", label: "Number the points" },
  ],
});

export const buttonComponent = defineComponent({
  type: "button",
  label: "Button",
  keywords: ["cta", "call to action"],
  description: "A link that looks like a button, for the main thing you want visitors to do.",
  icon: "mouse-pointer-click",
  category: "navigation",
  propsSchema: z.object({
    label: plainText(200, "Get started"),
    href: linkAddressSchema.default(""),
    openInNewTab: z.boolean().default(false),
  }),
  defaultProps: { label: "Get started", href: "", openInNewTab: false },
  defaultStyles: {
    base: {
      display: "inline-block",
      paddingTop: "var(--lintel-space-3)",
      paddingBottom: "var(--lintel-space-3)",
      paddingLeft: "var(--lintel-space-5)",
      paddingRight: "var(--lintel-space-5)",
      backgroundColor: "var(--lintel-color-brand)",
      color: "var(--lintel-color-on-brand)",
      borderRadius: "var(--lintel-radius-button)",
      fontWeight: "600",
      textDecoration: "none",
      width: "fit-content",
    },
    hover: { opacity: "0.88" },
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "label", label: "Words on the button" },
    { kind: "link", prop: "href", label: "Where it goes" },
    { kind: "toggle", prop: "openInNewTab", label: "Open in a new tab" },
  ],
});

export const linkComponent = defineComponent({
  type: "link",
  label: "Link",
  description: "Words that take visitors to another page or website.",
  icon: "link",
  category: "navigation",
  propsSchema: z.object({
    label: plainText(500, "Read more"),
    href: linkAddressSchema.default(""),
    openInNewTab: z.boolean().default(false),
  }),
  defaultProps: { label: "Read more", href: "", openInNewTab: false },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "label", label: "Words" },
    { kind: "link", prop: "href", label: "Where it goes" },
    { kind: "toggle", prop: "openInNewTab", label: "Open in a new tab" },
  ],
});

export const navigationComponent = defineComponent({
  type: "navigation",
  label: "Menu",
  keywords: ["nav", "navbar", "links"],
  description: "A row of links to the main pages of your site.",
  icon: "menu",
  category: "navigation",
  propsSchema: z.object({
    // Menus made before they could follow the site's menus kept their own links.
    menuSource: oneOf(["custom", "site"], "Where the links come from"),
    menuHandle: menuHandleSchema,
    label: plainText(100, "Main"),
    links: z
      .array(linkSchema, { error: "A menu’s links should be a list" })
      .max(50, { error: "A menu can have at most 50 links" })
      .default([]),
  }),
  defaultProps: {
    menuSource: "site",
    menuHandle: "main",
    label: "Main",
    links: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  // Its one Menu link is the look of every link in it (see menu-links/).
  allowedChildren: ["menuLink"],
  defaultChildren: [{ type: "menuLink" }],
  editableFields: [
    menuSourceField,
    { kind: "text", prop: "label", label: "Name for screen readers" },
    { kind: "linkList", prop: "links", label: "Links I choose" },
  ],
});

export const imageComponent = defineComponent({
  type: "image",
  label: "Picture",
  keywords: ["photo", "picture", "img"],
  description:
    "A photo or illustration from your media library, with a description for people who can’t see it.",
  icon: "image",
  category: "media",
  propsSchema: z.object({
    src: imageAddressSchema.default(""),
    alt: plainText(500),
    assetId: z.string().max(100).nullable().default(null),
    caption: plainText(500),
    /** Show the photo's credit under it, when its licence asks for one (see PageData.credits). */
    showCredit: z.boolean().default(true),
  }),
  defaultProps: { src: "", alt: "", assetId: null, caption: "", showCredit: true },
  defaultStyles: {
    base: { width: "100%", height: "auto", borderRadius: "var(--lintel-radius-medium)" },
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "image", prop: "src", label: "Picture" },
    {
      kind: "multilineText",
      prop: "alt",
      label: "Describe the picture",
      placeholder: "A smiling barista pouring coffee",
    },
    { kind: "text", prop: "caption", label: "Caption (shown under it)" },
    { kind: "toggle", prop: "showCredit", label: "Show the photo credit" },
  ],
});

export const dividerComponent = defineComponent({
  type: "divider",
  label: "Divider",
  keywords: ["line", "rule", "separator", "hr"],
  description: "A thin line that separates one part of the page from the next.",
  icon: "minus",
  category: "layout",
  propsSchema: z.object({}),
  defaultProps: {},
  defaultStyles: {
    base: {
      borderStyle: "solid",
      borderColor: "var(--lintel-color-border)",
      borderWidth: "1px 0 0 0",
      width: "100%",
    },
  },
  allowedChildren: "none",
  editableFields: [],
});
