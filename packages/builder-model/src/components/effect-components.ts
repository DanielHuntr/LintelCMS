import { z } from "zod";
import {
  type AnyComponentDefinition,
  defineComponent,
  type NodeBlueprint,
} from "./component-definition.js";
import { itemsOf, linkAddressSchema, linkSchema, oneOf, plainText } from "./component-props.js";

/**
 * Ready-made animated elements: each is drawn like an ordinary element and starts with the
 * effects that bring it to life, which people can change or remove on the Animate tab.
 * Without scripts, and for people who ask for less motion, each still reads and works.
 */

const card = (title: string, words: string): NodeBlueprint => ({
  type: "card",
  props: { look: "raised" },
  children: [
    { type: "heading", props: { text: title, level: 3 } },
    { type: "text", props: { text: words } },
  ],
});

const picture = (index: number): NodeBlueprint => ({
  type: "image",
  props: { src: "", alt: `Picture ${index}` },
  styles: { base: { width: "220px", height: "160px", objectFit: "cover", borderRadius: "16px" } },
});

export const magneticButtonComponent = defineComponent({
  type: "magneticButton",
  label: "Magnetic button",
  keywords: ["hover", "cursor", "interactive"],
  description: "A button that leans towards the pointer and squashes a little when pressed.",
  icon: "sparkles",
  category: "blocks",
  propsSchema: z.object({
    text: plainText(80, "Get started"),
    href: linkAddressSchema.default(""),
  }),
  defaultProps: { text: "Get started", href: "" },
  defaultEffects: [
    { effect: "magnetic-pull", params: {} },
    { effect: "press-squish", params: {} },
  ],
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "text", label: "Words on the button" },
    { kind: "link", prop: "href", label: "Where it goes" },
  ],
});

export const cardStackComponent = defineComponent({
  type: "cardStack",
  label: "Card stack",
  keywords: ["carousel", "swipe", "deck"],
  description:
    "Cards piled on one another; visitors click, swipe or use the arrow keys to see the next.",
  icon: "gallery-thumbnails",
  category: "blocks",
  propsSchema: z.object({ label: plainText(100, "Stories") }),
  defaultProps: { label: "Stories" },
  defaultChildren: [
    card("Warm welcome", "Tell people what makes you different."),
    card("Made by hand", "A sentence about how you work."),
    card("Close to home", "Where to find you, and when."),
  ],
  defaultEffects: [{ effect: "card-stack", params: {} }],
  allowedChildren: "any",
  editableFields: [
    { kind: "text", prop: "label", label: "What the stack is called (for screen readers)" },
  ],
});

export const cylinderGalleryComponent = defineComponent({
  type: "cylinderGallery",
  label: "3D gallery",
  keywords: ["carousel", "3d", "rotating", "photos"],
  description: "Pictures around a slowly turning cylinder; visitors drag to spin it.",
  icon: "gallery-horizontal",
  category: "media",
  propsSchema: z.object({ label: plainText(100, "Gallery") }),
  defaultProps: { label: "Gallery" },
  defaultChildren: [1, 2, 3, 4, 5, 6, 7, 8].map(picture),
  defaultStyles: { base: { height: "360px" } },
  defaultEffects: [{ effect: "cylinder-gallery", params: {} }],
  allowedChildren: "any",
  editableFields: [
    { kind: "text", prop: "label", label: "What the gallery is called (for screen readers)" },
  ],
});

export const arcCarouselComponent = defineComponent({
  type: "arcCarousel",
  label: "Arc carousel",
  keywords: ["carousel", "curved", "3d", "gallery", "slider", "photos"],
  description:
    "Pictures on a curve that drifts by in 3D; visitors drag, swipe or scroll to move it.",
  icon: "gallery-horizontal-end",
  category: "media",
  propsSchema: z.object({ label: plainText(100, "Gallery") }),
  defaultProps: { label: "Gallery" },
  defaultChildren: [1, 2, 3, 4, 5, 6, 7, 8].map(picture),
  defaultStyles: { base: { height: "380px" } },
  defaultEffects: [{ effect: "arc-carousel", params: {} }],
  allowedChildren: "any",
  editableFields: [
    { kind: "text", prop: "label", label: "What the gallery is called (for screen readers)" },
  ],
});

export const scrollingRowComponent = defineComponent({
  type: "scrollingRow",
  label: "Scrolling row",
  keywords: ["horizontal scroll", "carousel", "sideways"],
  description: "Words or logos drifting sideways in an endless row, faster while visitors scroll.",
  icon: "move-horizontal",
  category: "blocks",
  propsSchema: z.object({ label: plainText(100, "") }),
  defaultProps: { label: "" },
  defaultChildren: ["Fresh every morning", "✦", "Baked by hand", "✦", "Open seven days", "✦"].map(
    (words) => ({
      type: "text",
      props: { text: words },
      styles: { base: { fontSize: "2rem", fontWeight: "700", whiteSpace: "nowrap" } },
    }),
  ),
  defaultStyles: {
    base: { display: "flex", gap: "2rem", paddingTop: "1rem", paddingBottom: "1rem" },
  },
  defaultEffects: [{ effect: "marquee-drift", params: {} }],
  allowedChildren: "any",
  editableFields: [],
});

export const counterRowComponent = defineComponent({
  type: "counterRow",
  label: "Counter row",
  keywords: ["stats", "statistics", "numbers", "count up"],
  description: "A row of big numbers that count up when they come into view: “1,200 customers”.",
  icon: "hash",
  category: "blocks",
  propsSchema: z.object({}),
  defaultProps: {},
  defaultChildren: [
    ["1,200+", "happy customers"],
    ["15", "years baking"],
    ["4.9", "average rating"],
  ].map(([number, label]) => ({
    type: "box",
    children: [
      {
        type: "heading",
        props: { text: number, level: 3 },
        effects: [{ effect: "count-up", params: {} }],
      },
      { type: "text", props: { text: label } },
    ],
  })),
  defaultStyles: {
    base: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
      gap: "2rem",
      textAlign: "center",
    },
  },
  allowedChildren: "any",
  editableFields: [],
});

export const toggleSwitchComponent = defineComponent({
  type: "toggleSwitch",
  label: "Switch",
  keywords: ["toggle", "monthly yearly", "checkbox"],
  description:
    "An on and off switch whose knob springs across. Good for “Monthly or yearly” choices.",
  icon: "sliders-horizontal",
  category: "forms",
  propsSchema: z.object({ label: plainText(100, "Yearly prices"), on: z.boolean().default(false) }),
  defaultProps: { label: "Yearly prices", on: false },
  defaultEffects: [{ effect: "spring-switch", params: {} }],
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "label", label: "What it switches" },
    { kind: "toggle", prop: "on", label: "Starts switched on" },
  ],
});

export const radialMenuComponent = defineComponent({
  type: "radialMenu",
  label: "Round menu",
  keywords: ["floating", "contact", "fab", "speed dial"],
  description: "A button that fans its links out in a circle. Handy for a few quick actions.",
  icon: "plus",
  category: "navigation",
  propsSchema: z.object({
    label: plainText(60, "Quick links"),
    links: itemsOf(linkSchema, 8, "links").default([
      { label: "Call", href: "tel:" },
      { label: "Email", href: "mailto:" },
      { label: "Map", href: "" },
    ]),
  }),
  defaultProps: {
    label: "Quick links",
    links: [
      { label: "Call", href: "tel:" },
      { label: "Email", href: "mailto:" },
      { label: "Map", href: "" },
    ],
  },
  defaultEffects: [{ effect: "radial-menu", params: {} }],
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "label", label: "What the button says to screen readers" },
    { kind: "linkList", prop: "links", label: "Links" },
  ],
});

export const notificationToastComponent = defineComponent({
  type: "notificationToast",
  label: "Notification",
  keywords: ["toast", "alert", "banner", "message"],
  description: "A small message that slides in at the corner of the screen, then leaves by itself.",
  icon: "bell",
  category: "blocks",
  propsSchema: z.object({
    title: plainText(80, "Free delivery this week"),
    message: plainText(200, "On every order over £20."),
    corner: oneOf(["bottom-right", "bottom-left", "top-right", "top-left"], "The corner"),
    closeLabel: plainText(40, "Close"),
  }),
  defaultProps: {
    title: "Free delivery this week",
    message: "On every order over £20.",
    corner: "bottom-right",
    closeLabel: "Close",
  },
  defaultEffects: [{ effect: "toast", params: {} }],
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "title", label: "Heading" },
    { kind: "multilineText", prop: "message", label: "Message" },
    {
      kind: "choice",
      prop: "corner",
      label: "Corner of the screen",
      choices: [
        { value: "bottom-right", label: "Bottom right" },
        { value: "bottom-left", label: "Bottom left" },
        { value: "top-right", label: "Top right" },
        { value: "top-left", label: "Top left" },
      ],
    },
    {
      kind: "text",
      prop: "closeLabel",
      label: "Close button (for screen readers)",
      advanced: true,
    },
  ],
});

/** In the order the Insert panel lists them, with their props types erased for the catalogue. */
export const effectComponents = [
  magneticButtonComponent,
  cardStackComponent,
  cylinderGalleryComponent,
  arcCarouselComponent,
  scrollingRowComponent,
  counterRowComponent,
  toggleSwitchComponent,
  radialMenuComponent,
  notificationToastComponent,
] as unknown as readonly AnyComponentDefinition[];
