import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import { linkAddressSchema, oneOf, plainText, wholeNumber } from "./component-props.js";

/**
 * Layout elements beyond sections and columns: a grid, spacing, cards, tabs, an accordion,
 * a pop-up and a container that sticks while the page scrolls.
 */

const columnChoices = [1, 2, 3, 4, 5, 6].map((count) => ({
  value: String(count),
  label: count === 1 ? "1 column" : `${count} columns`,
}));

const gapChoices = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export const gridComponent = defineComponent({
  type: "grid",
  label: "Grid",
  description:
    "Puts items in rows and columns, such as cards. Choose how many columns each screen size has.",
  icon: "layout-grid",
  category: "layout",
  propsSchema: z.object({
    columns: wholeNumber(1, 6, 3),
    tabletColumns: wholeNumber(1, 6, 2),
    phoneColumns: wholeNumber(1, 6, 1),
    gap: oneOf(["medium", "small", "large"], "The space between items"),
  }),
  defaultProps: { columns: 3, tabletColumns: 2, phoneColumns: 1, gap: "medium" },
  defaultChildren: [
    { type: "card", name: "Item" },
    { type: "card", name: "Item" },
    { type: "card", name: "Item" },
  ],
  allowedChildren: "any",
  editableFields: [
    { kind: "choice", prop: "columns", label: "Columns on computers", choices: columnChoices },
    { kind: "choice", prop: "tabletColumns", label: "Columns on tablets", choices: columnChoices },
    { kind: "choice", prop: "phoneColumns", label: "Columns on phones", choices: columnChoices },
    { kind: "choice", prop: "gap", label: "Space between items", choices: gapChoices },
  ],
});

export const spacerComponent = defineComponent({
  type: "spacer",
  label: "Spacer",
  description: "Empty space between two things, a little smaller on phones.",
  icon: "move-vertical",
  category: "layout",
  propsSchema: z.object({
    size: oneOf(["medium", "small", "large", "extraLarge"], "The space"),
  }),
  defaultProps: { size: "medium" },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "choice",
      prop: "size",
      label: "How much space",
      choices: [
        { value: "small", label: "A little" },
        { value: "medium", label: "Some" },
        { value: "large", label: "A lot" },
        { value: "extraLarge", label: "A great deal" },
      ],
    },
  ],
});

export const cardComponent = defineComponent({
  type: "card",
  label: "Card",
  description:
    "A panel that groups a picture, a title and some words, often used in a grid. It can link somewhere.",
  icon: "credit-card",
  category: "layout",
  propsSchema: z.object({
    href: linkAddressSchema.default(""),
    look: oneOf(["outlined", "raised", "filled", "plain"], "The card’s look"),
  }),
  defaultProps: { href: "", look: "outlined" },
  defaultChildren: [
    { type: "heading", props: { text: "Card title", level: 3 } },
    { type: "text", props: { text: "A sentence or two about this." } },
  ],
  allowedChildren: "any",
  editableFields: [
    {
      kind: "choice",
      prop: "look",
      label: "Look",
      choices: [
        { value: "outlined", label: "With a border" },
        { value: "raised", label: "With a shadow" },
        { value: "filled", label: "Tinted" },
        { value: "plain", label: "Plain" },
      ],
    },
    { kind: "link", prop: "href", label: "Whole card links to (optional)" },
  ],
});

export const tabPanelComponent = defineComponent({
  type: "tabPanel",
  label: "Tab",
  description: "One tab: its name, and what shows when it is chosen.",
  icon: "panel-top",
  category: "layout",
  propsSchema: z.object({ label: plainText(80, "Tab") }),
  defaultProps: { label: "Tab" },
  defaultChildren: [{ type: "text", props: { text: "What this tab shows." } }],
  allowedChildren: "any",
  allowedParents: ["tabs"],
  editableFields: [{ kind: "text", prop: "label", label: "Tab name" }],
  hiddenFromInsert: true,
});

export const tabsComponent = defineComponent({
  type: "tabs",
  label: "Tabs",
  description: "Several panels in the same space; visitors choose which one to see.",
  icon: "folder-open",
  category: "layout",
  propsSchema: z.object({ label: plainText(100, "More details") }),
  defaultProps: { label: "More details" },
  defaultChildren: [
    { type: "tabPanel", props: { label: "First tab" } },
    { type: "tabPanel", props: { label: "Second tab" } },
    { type: "tabPanel", props: { label: "Third tab" } },
  ],
  defaultEffects: [{ effect: "tab-slider", params: {} }],
  allowedChildren: ["tabPanel"],
  editableFields: [{ kind: "text", prop: "label", label: "Name for screen readers" }],
});

export const accordionItemComponent = defineComponent({
  type: "accordionItem",
  label: "Accordion item",
  description: "A title that opens to show more.",
  icon: "chevrons-up-down",
  category: "layout",
  propsSchema: z.object({
    title: plainText(300, "A question people ask"),
    startsOpen: z.boolean().default(false),
  }),
  defaultProps: { title: "A question people ask", startsOpen: false },
  defaultChildren: [{ type: "text", props: { text: "The answer, in a sentence or two." } }],
  allowedChildren: "any",
  allowedParents: ["accordion"],
  editableFields: [
    { kind: "text", prop: "title", label: "Title" },
    { kind: "toggle", prop: "startsOpen", label: "Open when the page loads" },
  ],
  hiddenFromInsert: true,
});

export const accordionComponent = defineComponent({
  type: "accordion",
  label: "Accordion",
  description: "Titles that open to show more when clicked, such as questions and answers.",
  icon: "chevrons-up-down",
  category: "layout",
  propsSchema: z.object({ onlyOneOpen: z.boolean().default(false) }),
  defaultProps: { onlyOneOpen: false },
  defaultChildren: [
    { type: "accordionItem", props: { title: "How long does delivery take?" } },
    { type: "accordionItem", props: { title: "Can I change my order?" } },
    { type: "accordionItem", props: { title: "Do you deliver abroad?" } },
  ],
  allowedChildren: ["accordionItem"],
  editableFields: [{ kind: "toggle", prop: "onlyOneOpen", label: "Open one at a time" }],
});

export const modalComponent = defineComponent({
  type: "modal",
  label: "Pop-up",
  description:
    "A button that opens a pop-up window over the page, with anything inside: a video, a form, a bigger picture.",
  icon: "app-window",
  category: "layout",
  propsSchema: z.object({
    buttonLabel: plainText(120, "Find out more"),
    title: plainText(200, "More about this"),
    size: oneOf(["medium", "small", "large", "full"], "The pop-up’s size"),
  }),
  defaultProps: { buttonLabel: "Find out more", title: "More about this", size: "medium" },
  defaultChildren: [{ type: "text", props: { text: "What the pop-up says." } }],
  allowedChildren: "any",
  editableFields: [
    { kind: "text", prop: "buttonLabel", label: "Words on the button" },
    { kind: "text", prop: "title", label: "Pop-up title" },
    {
      kind: "choice",
      prop: "size",
      label: "Size",
      choices: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
        { value: "full", label: "Whole screen" },
      ],
      advanced: true,
    },
  ],
});

export const stickyComponent = defineComponent({
  type: "sticky",
  label: "Sticky container",
  description: "Stays in view while the page scrolls past, such as a side menu or a header.",
  icon: "pin",
  category: "layout",
  propsSchema: z.object({
    edge: oneOf(["top", "bottom"], "The edge it sticks to"),
    offset: oneOf(["none", "small", "medium", "large"], "The distance from the edge"),
  }),
  defaultProps: { edge: "top", offset: "small" },
  allowedChildren: "any",
  editableFields: [
    {
      kind: "choice",
      prop: "edge",
      label: "Sticks to",
      choices: [
        { value: "top", label: "The top of the screen" },
        { value: "bottom", label: "The bottom of the screen" },
      ],
    },
    {
      kind: "choice",
      prop: "offset",
      label: "Distance from the edge",
      choices: [
        { value: "none", label: "None" },
        { value: "small", label: "A little" },
        { value: "medium", label: "Some" },
        { value: "large", label: "A lot" },
      ],
      advanced: true,
    },
  ],
});
