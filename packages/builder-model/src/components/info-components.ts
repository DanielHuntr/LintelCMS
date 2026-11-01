import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import {
  emptyPicture,
  iconNameSchema,
  itemsOf,
  linkAddressSchema,
  oneOf,
  pictureSchema,
  plainText,
  wholeNumber,
} from "./component-props.js";

/**
 * Elements that tell visitors something at a glance: numbers, labels, tables, a timeline,
 * reviews, prices, people, features, social links, a countdown and formatted text.
 */

export const marqueeComponent = defineComponent({
  type: "marquee",
  label: "Ticker",
  description:
    "Words that scroll slowly across the screen. It stops when the pointer is over it, and stays still for people who prefer less motion.",
  icon: "move-horizontal",
  category: "text",
  propsSchema: z.object({
    items: itemsOf(plainText(200), 30, "phrases").default([
      "Free delivery",
      "Made by hand",
      "Open every day",
    ]),
    speed: oneOf(["medium", "slow", "fast"], "The speed"),
    direction: oneOf(["left", "right"], "The direction"),
  }),
  defaultProps: {
    items: ["Free delivery", "Made by hand", "Open every day"],
    speed: "medium",
    direction: "left",
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "textList", prop: "items", label: "Phrases", itemLabel: "Phrase" },
    {
      kind: "choice",
      prop: "speed",
      label: "Speed",
      choices: [
        { value: "slow", label: "Slow" },
        { value: "medium", label: "Medium" },
        { value: "fast", label: "Fast" },
      ],
    },
    {
      kind: "choice",
      prop: "direction",
      label: "Moves towards",
      choices: [
        { value: "left", label: "The left" },
        { value: "right", label: "The right" },
      ],
      advanced: true,
    },
  ],
});

export const counterComponent = defineComponent({
  type: "counter",
  label: "Number",
  description:
    "A big number with a label, such as “1,200 happy customers”. It can count up as it comes into view.",
  icon: "hash",
  category: "text",
  propsSchema: z.object({
    value: z.number({ error: "The number should be a number" }).min(-1e12).max(1e12).default(1200),
    prefix: plainText(10),
    suffix: plainText(10, "+"),
    label: plainText(200, "Happy customers"),
    decimals: wholeNumber(0, 3, 0),
    countsUp: z.boolean().default(true),
  }),
  defaultProps: {
    value: 1200,
    prefix: "",
    suffix: "+",
    label: "Happy customers",
    decimals: 0,
    countsUp: true,
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "number", prop: "value", label: "Number" },
    { kind: "text", prop: "label", label: "What it counts" },
    { kind: "text", prop: "prefix", label: "Before the number (like £)", advanced: true },
    { kind: "text", prop: "suffix", label: "After the number (like + or %)", advanced: true },
    { kind: "number", prop: "decimals", label: "Decimal places", min: 0, max: 3, advanced: true },
    { kind: "toggle", prop: "countsUp", label: "Count up when it comes into view", advanced: true },
  ],
});

export const badgeComponent = defineComponent({
  type: "badge",
  label: "Badge",
  description: "A small label, such as “New” or “Sold out”.",
  icon: "tag",
  category: "text",
  propsSchema: z.object({
    text: plainText(60, "New"),
    tone: oneOf(["brand", "neutral", "success", "warning", "danger"], "The badge’s colour"),
    icon: iconNameSchema,
  }),
  defaultProps: { text: "New", tone: "brand", icon: "" },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "text", label: "Words" },
    {
      kind: "choice",
      prop: "tone",
      label: "Colour",
      choices: [
        { value: "brand", label: "Your brand colour" },
        { value: "neutral", label: "Grey" },
        { value: "success", label: "Green" },
        { value: "warning", label: "Amber" },
        { value: "danger", label: "Red" },
      ],
    },
    { kind: "icon", prop: "icon", label: "Icon (optional)", advanced: true },
  ],
});

const tableRowSchema = z.object({ cells: itemsOf(plainText(500), 12, "cells").default([]) });

export const tableComponent = defineComponent({
  type: "table",
  label: "Table",
  description: "Information in rows and columns, such as opening hours or a comparison.",
  icon: "table",
  category: "text",
  propsSchema: z.object({
    caption: plainText(300),
    headings: itemsOf(plainText(200), 12, "column headings").default(["Day", "Opening hours"]),
    rows: itemsOf(tableRowSchema, 200, "rows").default([]),
    firstColumnIsHeading: z.boolean().default(true),
    striped: z.boolean().default(true),
  }),
  defaultProps: {
    caption: "",
    headings: ["Day", "Opening hours"],
    rows: [
      { cells: ["Monday to Friday", "8am to 6pm"] },
      { cells: ["Saturday", "9am to 4pm"] },
      { cells: ["Sunday", "Closed"] },
    ],
    firstColumnIsHeading: true,
    striped: true,
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "caption", label: "What the table shows" },
    { kind: "textList", prop: "headings", label: "Column headings", itemLabel: "Heading" },
    {
      kind: "itemList",
      prop: "rows",
      label: "Rows",
      itemLabel: "Row",
      titleField: "cells.0",
      fields: [
        { kind: "textList", prop: "cells", label: "Cells, left to right", itemLabel: "Cell" },
      ],
      newItem: { cells: ["", ""] },
      maxItems: 200,
    },
    {
      kind: "toggle",
      prop: "firstColumnIsHeading",
      label: "First column names each row",
      advanced: true,
    },
    { kind: "toggle", prop: "striped", label: "Shade every other row", advanced: true },
  ],
});

const timelineItemSchema = z.object({
  when: plainText(100),
  title: plainText(200),
  text: plainText(2000),
});

export const timelineComponent = defineComponent({
  type: "timeline",
  label: "Timeline",
  description: "Moments in order, such as your story or the steps of a process.",
  icon: "milestone",
  category: "text",
  propsSchema: z.object({
    items: itemsOf(timelineItemSchema, 100, "moments").default([]),
    numbered: z.boolean().default(false),
  }),
  defaultProps: {
    items: [
      { when: "2019", title: "We opened", text: "A small shop with one oven." },
      { when: "2022", title: "We grew", text: "A second shop, and a team of twelve." },
      { when: "Today", title: "Still baking", text: "Every morning, from 5am." },
    ],
    numbered: false,
  },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "itemList",
      prop: "items",
      label: "Moments",
      itemLabel: "Moment",
      titleField: "title",
      fields: [
        { kind: "text", prop: "when", label: "When" },
        { kind: "text", prop: "title", label: "Title" },
        { kind: "multilineText", prop: "text", label: "What happened" },
      ],
      newItem: { when: "", title: "", text: "" },
      maxItems: 100,
    },
    {
      kind: "toggle",
      prop: "numbered",
      label: "Number the steps instead of dates",
      advanced: true,
    },
  ],
});

export const testimonialComponent = defineComponent({
  type: "testimonial",
  label: "Testimonial",
  description: "A review from a customer, with their name, photo and a star rating.",
  icon: "message-square-quote",
  category: "text",
  propsSchema: z.object({
    quote: plainText(2000, "They were brilliant from start to finish."),
    name: plainText(200, "Sam Taylor"),
    role: plainText(200, "Customer"),
    photo: pictureSchema.default(emptyPicture),
    rating: wholeNumber(0, 5, 5),
  }),
  defaultProps: {
    quote: "They were brilliant from start to finish.",
    name: "Sam Taylor",
    role: "Customer",
    photo: emptyPicture,
    rating: 5,
  },
  allowedChildren: "none",
  allowedParents: undefined,
  editableFields: [
    { kind: "multilineText", prop: "quote", label: "What they said" },
    { kind: "text", prop: "name", label: "Their name" },
    { kind: "text", prop: "role", label: "Who they are", placeholder: "Customer since 2021" },
    { kind: "image", prop: "photo", label: "Their photo" },
    {
      kind: "choice",
      prop: "rating",
      label: "Stars",
      choices: [
        { value: "0", label: "Don’t show stars" },
        ...[1, 2, 3, 4, 5].map((count) => ({ value: String(count), label: `${count} of 5` })),
      ],
    },
  ],
});

export const testimonialSliderComponent = defineComponent({
  type: "testimonialSlider",
  label: "Testimonial slider",
  description: "Several reviews that visitors move through, one at a time.",
  icon: "messages-square",
  category: "text",
  propsSchema: z.object({
    label: plainText(120, "What customers say"),
    perView: wholeNumber(1, 3, 1),
    autoplay: z.boolean().default(false),
    autoplaySeconds: wholeNumber(3, 20, 8),
    loop: z.boolean().default(true),
    showDots: z.boolean().default(true),
  }),
  defaultProps: {
    label: "What customers say",
    perView: 1,
    autoplay: false,
    autoplaySeconds: 8,
    loop: true,
    showDots: true,
  },
  defaultChildren: [
    { type: "slide", children: [{ type: "testimonial" }] },
    {
      type: "slide",
      children: [
        {
          type: "testimonial",
          props: { quote: "Friendly, quick and fairly priced.", name: "Priya Shah" },
        },
      ],
    },
  ],
  allowedChildren: ["slide"],
  editableFields: [
    { kind: "text", prop: "label", label: "Name for screen readers" },
    { kind: "toggle", prop: "showDots", label: "Show a dot for each review" },
    { kind: "toggle", prop: "autoplay", label: "Move on by itself", advanced: true },
    {
      kind: "number",
      prop: "autoplaySeconds",
      label: "Seconds on each review",
      min: 3,
      max: 20,
      unit: "s",
      advanced: true,
    },
  ],
});

const planSchema = z.object({
  name: plainText(100),
  price: plainText(40),
  period: plainText(40),
  description: plainText(500),
  features: itemsOf(plainText(200), 30, "features").default([]),
  buttonLabel: plainText(80, "Choose"),
  buttonHref: linkAddressSchema.default(""),
  highlighted: z.boolean().default(false),
  badge: plainText(40),
});

export const pricingTableComponent = defineComponent({
  type: "pricingTable",
  label: "Pricing table",
  description: "Your plans or packages side by side, with what each includes. One can stand out.",
  icon: "badge-pound-sterling",
  category: "text",
  propsSchema: z.object({ plans: itemsOf(planSchema, 6, "plans").default([]) }),
  defaultProps: {
    plans: [
      {
        name: "Starter",
        price: "£9",
        period: "a month",
        description: "For trying things out.",
        features: ["One site", "Email help"],
        buttonLabel: "Start",
        buttonHref: "",
        highlighted: false,
        badge: "",
      },
      {
        name: "Growing",
        price: "£29",
        period: "a month",
        description: "For a busy small business.",
        features: ["Five sites", "Phone help", "Your own address"],
        buttonLabel: "Choose Growing",
        buttonHref: "",
        highlighted: true,
        badge: "Most popular",
      },
      {
        name: "Agency",
        price: "£99",
        period: "a month",
        description: "For looking after clients.",
        features: ["Unlimited sites", "Priority help"],
        buttonLabel: "Talk to us",
        buttonHref: "",
        highlighted: false,
        badge: "",
      },
    ],
  },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "itemList",
      prop: "plans",
      label: "Plans",
      itemLabel: "Plan",
      titleField: "name",
      maxItems: 6,
      fields: [
        { kind: "text", prop: "name", label: "Name" },
        { kind: "text", prop: "price", label: "Price", placeholder: "£29" },
        { kind: "text", prop: "period", label: "Per", placeholder: "a month" },
        { kind: "multilineText", prop: "description", label: "Who it’s for" },
        { kind: "textList", prop: "features", label: "What’s included", itemLabel: "Feature" },
        { kind: "text", prop: "buttonLabel", label: "Words on the button" },
        { kind: "link", prop: "buttonHref", label: "Button goes to" },
        { kind: "toggle", prop: "highlighted", label: "Make this plan stand out" },
        { kind: "text", prop: "badge", label: "Badge (like “Most popular”)" },
      ],
      newItem: {
        name: "New plan",
        price: "",
        period: "",
        description: "",
        features: [],
        buttonLabel: "Choose",
        buttonHref: "",
        highlighted: false,
        badge: "",
      },
    },
  ],
});

const socialNetworks = [
  "instagram",
  "facebook",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "github",
  "mastodon",
  "bluesky",
  "threads",
  "whatsapp",
  "email",
  "website",
] as const;

const socialLinkSchema = z.object({
  network: z.enum(socialNetworks).default("website"),
  href: linkAddressSchema.default(""),
});

const networkChoices = socialNetworks.map((network) => ({
  value: network,
  label:
    {
      x: "X (Twitter)",
      linkedin: "LinkedIn",
      youtube: "YouTube",
      tiktok: "TikTok",
      github: "GitHub",
      whatsapp: "WhatsApp",
    }[network as string] ?? network.charAt(0).toUpperCase() + network.slice(1),
}));

export const socialLinksComponent = defineComponent({
  type: "socialLinks",
  label: "Social links",
  description: "Icons that link to your pages on Instagram, Facebook, LinkedIn and others.",
  icon: "share-2",
  category: "navigation",
  propsSchema: z.object({
    links: itemsOf(socialLinkSchema, 20, "links").default([]),
    size: oneOf(["medium", "small", "large"], "The icons’ size"),
  }),
  defaultProps: {
    links: [
      { network: "instagram", href: "https://instagram.com/" },
      { network: "facebook", href: "https://facebook.com/" },
      { network: "linkedin", href: "https://linkedin.com/" },
    ],
    size: "medium",
  },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "itemList",
      prop: "links",
      label: "Links",
      itemLabel: "Link",
      titleField: "network",
      maxItems: 20,
      fields: [
        { kind: "choice", prop: "network", label: "Where", choices: networkChoices },
        { kind: "link", prop: "href", label: "Address of your page" },
      ],
      newItem: { network: "website", href: "" },
    },
    {
      kind: "choice",
      prop: "size",
      label: "Size",
      choices: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
      advanced: true,
    },
  ],
});

export const socialNetworkNames = socialNetworks;

export const teamMemberComponent = defineComponent({
  type: "teamMember",
  label: "Team member",
  description: "A person: their photo, name, role, a few words and links.",
  icon: "user-round",
  category: "text",
  propsSchema: z.object({
    photo: pictureSchema.default(emptyPicture),
    name: plainText(200, "Alex Morgan"),
    role: plainText(200, "Founder"),
    bio: plainText(2000),
    links: itemsOf(socialLinkSchema, 8, "links").default([]),
  }),
  defaultProps: { photo: emptyPicture, name: "Alex Morgan", role: "Founder", bio: "", links: [] },
  allowedChildren: "none",
  editableFields: [
    { kind: "image", prop: "photo", label: "Photo" },
    { kind: "text", prop: "name", label: "Name" },
    { kind: "text", prop: "role", label: "Role" },
    { kind: "multilineText", prop: "bio", label: "A few words about them" },
    {
      kind: "itemList",
      prop: "links",
      label: "Links",
      itemLabel: "Link",
      titleField: "network",
      maxItems: 8,
      fields: [
        { kind: "choice", prop: "network", label: "Where", choices: networkChoices },
        { kind: "link", prop: "href", label: "Address" },
      ],
      newItem: { network: "linkedin", href: "" },
      advanced: true,
    },
  ],
});

const featureSchema = z.object({
  icon: iconNameSchema.default("check"),
  title: plainText(200),
  text: plainText(1000),
});

export const featureListComponent = defineComponent({
  type: "featureList",
  label: "Feature list",
  description: "Points with an icon each, such as what you offer or why people choose you.",
  icon: "list-checks",
  category: "text",
  propsSchema: z.object({
    features: itemsOf(featureSchema, 40, "features").default([]),
    layout: oneOf(["grid", "list"], "The layout"),
    columns: wholeNumber(1, 4, 3),
  }),
  defaultProps: {
    features: [
      { icon: "truck", title: "Free delivery", text: "On every order over £30." },
      { icon: "leaf", title: "Made sustainably", text: "Local suppliers and recycled packaging." },
      { icon: "heart-handshake", title: "Here to help", text: "Real people, seven days a week." },
    ],
    layout: "grid",
    columns: 3,
  },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "itemList",
      prop: "features",
      label: "Features",
      itemLabel: "Feature",
      titleField: "title",
      maxItems: 40,
      fields: [
        { kind: "icon", prop: "icon", label: "Icon" },
        { kind: "text", prop: "title", label: "Title" },
        { kind: "multilineText", prop: "text", label: "Description" },
      ],
      newItem: { icon: "check", title: "", text: "" },
    },
    {
      kind: "choice",
      prop: "layout",
      label: "Layout",
      choices: [
        { value: "grid", label: "Side by side" },
        { value: "list", label: "One under another" },
      ],
    },
    {
      kind: "choice",
      prop: "columns",
      label: "Columns on computers",
      choices: [1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) })),
      advanced: true,
    },
  ],
});

export const countdownComponent = defineComponent({
  type: "countdown",
  label: "Countdown",
  description: "Days, hours and minutes until a date, such as a launch or a sale ending.",
  icon: "timer",
  category: "text",
  propsSchema: z.object({
    until: z
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?)?$/, {
        error: "The date should look like 2027-01-31T09:00",
      })
      .default(""),
    label: plainText(200, "Our sale ends in"),
    finishedText: plainText(200, "It’s here!"),
    showSeconds: z.boolean().default(false),
  }),
  defaultProps: {
    until: "",
    label: "Our sale ends in",
    finishedText: "It’s here!",
    showSeconds: false,
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "dateTime", prop: "until", label: "Counts down to" },
    { kind: "text", prop: "label", label: "Words above" },
    { kind: "text", prop: "finishedText", label: "Words when the time comes" },
    { kind: "toggle", prop: "showSeconds", label: "Show seconds", advanced: true },
  ],
});

export const richTextComponent = defineComponent({
  type: "richText",
  label: "Rich text",
  description:
    "Longer writing with headings, bold, italics, links and lists. Type **bold**, *italics*, ## for a heading and - for a list.",
  icon: "text",
  category: "text",
  propsSchema: z.object({
    markdown: plainText(
      50000,
      "## A heading\n\nA paragraph with **bold** words and a [link](/about).\n\n- A point\n- Another point",
    ),
  }),
  defaultProps: {
    markdown:
      "## A heading\n\nA paragraph with **bold** words and a [link](/about).\n\n- A point\n- Another point",
  },
  allowedChildren: "none",
  editableFields: [{ kind: "multilineText", prop: "markdown", label: "Text" }],
});

export const breadcrumbsComponent = defineComponent({
  type: "breadcrumbs",
  label: "Breadcrumbs",
  description: "Shows where this page sits in the site, such as Home › Blog › This post.",
  icon: "chevrons-right",
  category: "navigation",
  propsSchema: z.object({
    links: itemsOf(
      z.object({ label: plainText(200), href: linkAddressSchema.default("") }),
      10,
      "links",
    ).default([]),
    current: plainText(200, "This page"),
  }),
  defaultProps: { links: [{ label: "Home", href: "/" }], current: "This page" },
  allowedChildren: "none",
  editableFields: [
    { kind: "linkList", prop: "links", label: "Pages above this one" },
    { kind: "text", prop: "current", label: "This page’s name" },
  ],
});
