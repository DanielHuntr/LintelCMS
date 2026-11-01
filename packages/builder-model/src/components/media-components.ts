import { z } from "zod";
import { defineComponent, type SimpleField } from "./component-definition.js";
import {
  emptyPicture,
  iconNameSchema,
  imageAddressSchema,
  isAllowedEmbedAddress,
  itemsOf,
  linkAddressSchema,
  oneOf,
  pictureSchema,
  plainText,
  wholeNumber,
} from "./component-props.js";

/**
 * Video, sound, galleries, sliders, icons, maps and embeds. Anything from another website
 * (YouTube, a map, an embed) waits for the visitor to ask for it, so nothing is loaded from
 * elsewhere, and no cookies are set, until they do.
 */

/** An address of a file on the site or the web: what a video or sound file is played from. */
const mediaAddressSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((address) => address === "" || /^(https:\/\/|\/(?!\/))/i.test(address), {
    error: "A file’s address should start with https:// or /",
  })
  .default("");

const pictureFields: readonly SimpleField[] = [
  { kind: "image", prop: "image", label: "Picture" },
  { kind: "text", prop: "caption", label: "Caption (optional)" },
];

export const videoComponent = defineComponent({
  type: "video",
  label: "Video",
  description:
    "A video you upload, or one from YouTube or Vimeo. Videos from elsewhere only load when a visitor presses play.",
  icon: "video",
  category: "media",
  propsSchema: z.object({
    source: oneOf(["file", "youtube", "vimeo"], "Where the video is"),
    url: z.string().trim().max(2000).default(""),
    title: plainText(200, "Video"),
    poster: imageAddressSchema.default(""),
    shape: oneOf(["16:9", "4:3", "1:1", "9:16"], "The video’s shape"),
    autoplayMuted: z.boolean().default(false),
    loop: z.boolean().default(false),
    captionsUrl: mediaAddressSchema,
  }),
  defaultProps: {
    source: "youtube",
    url: "",
    title: "Video",
    poster: "",
    shape: "16:9",
    autoplayMuted: false,
    loop: false,
    captionsUrl: "",
  },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "choice",
      prop: "source",
      label: "Where the video is",
      choices: [
        { value: "youtube", label: "YouTube" },
        { value: "vimeo", label: "Vimeo" },
        { value: "file", label: "A file I uploaded" },
      ],
    },
    {
      kind: "text",
      prop: "url",
      label: "Video address",
      placeholder: "https://www.youtube.com/watch?v=…",
    },
    { kind: "text", prop: "title", label: "What the video is about" },
    { kind: "image", prop: "poster", label: "Picture before it plays" },
    {
      kind: "choice",
      prop: "shape",
      label: "Shape",
      choices: [
        { value: "16:9", label: "Wide (16:9)" },
        { value: "4:3", label: "Classic (4:3)" },
        { value: "1:1", label: "Square" },
        { value: "9:16", label: "Tall, for phones (9:16)" },
      ],
      advanced: true,
    },
    { kind: "toggle", prop: "autoplayMuted", label: "Play silently on its own", advanced: true },
    { kind: "toggle", prop: "loop", label: "Play again at the end", advanced: true },
    { kind: "text", prop: "captionsUrl", label: "Captions file (.vtt)", advanced: true },
  ],
});

export const audioComponent = defineComponent({
  type: "audio",
  label: "Sound",
  description: "A sound file visitors can play, such as a podcast episode or a song.",
  icon: "audio-lines",
  category: "media",
  propsSchema: z.object({
    url: mediaAddressSchema,
    title: plainText(200, "Listen"),
    transcript: plainText(20000),
  }),
  defaultProps: { url: "", title: "Listen", transcript: "" },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "url", label: "Sound file address", placeholder: "/media/episode-1.mp3" },
    { kind: "text", prop: "title", label: "Title" },
    { kind: "multilineText", prop: "transcript", label: "Transcript", advanced: true },
  ],
});

const galleryItemSchema = z.object({
  image: pictureSchema.default(emptyPicture),
  caption: plainText(300),
});

export const galleryComponent = defineComponent({
  type: "gallery",
  label: "Gallery",
  description: "Several pictures in a grid. Visitors can open each one bigger.",
  icon: "images",
  category: "media",
  propsSchema: z.object({
    pictures: itemsOf(galleryItemSchema, 200, "pictures").default([]),
    arrangement: oneOf(["grid", "masonry", "justified"], "The arrangement"),
    columns: wholeNumber(2, 6, 3),
    opensBigger: z.boolean().default(true),
  }),
  defaultProps: { pictures: [], arrangement: "grid", columns: 3, opensBigger: true },
  allowedChildren: "none",
  editableFields: [
    {
      kind: "itemList",
      prop: "pictures",
      label: "Pictures",
      itemLabel: "Picture",
      titleField: "image.alt",
      fields: pictureFields,
      newItem: { image: emptyPicture, caption: "" },
      maxItems: 200,
    },
    {
      kind: "choice",
      prop: "arrangement",
      label: "Arrangement",
      choices: [
        { value: "grid", label: "Even grid" },
        { value: "masonry", label: "Brick wall (keeps each shape)" },
        { value: "justified", label: "Rows of even height" },
      ],
    },
    {
      kind: "choice",
      prop: "columns",
      label: "Columns",
      choices: [2, 3, 4, 5, 6].map((count) => ({ value: String(count), label: String(count) })),
      advanced: true,
    },
    {
      kind: "toggle",
      prop: "opensBigger",
      label: "Open pictures bigger when clicked",
      advanced: true,
    },
  ],
});

export const slideComponent = defineComponent({
  type: "slide",
  label: "Slide",
  description: "One slide of a slider.",
  icon: "gallery-horizontal",
  category: "media",
  propsSchema: z.object({ label: plainText(120) }),
  defaultProps: { label: "" },
  defaultChildren: [
    { type: "image", props: { alt: "" } },
    { type: "heading", props: { text: "Slide title", level: 3 } },
  ],
  allowedChildren: "any",
  allowedParents: ["carousel", "testimonialSlider"],
  editableFields: [
    { kind: "text", prop: "label", label: "Name for screen readers", advanced: true },
  ],
  hiddenFromInsert: true,
});

const sliderProps = {
  label: plainText(120, "Slides"),
  perView: wholeNumber(1, 4, 1),
  autoplay: z.boolean().default(false),
  autoplaySeconds: wholeNumber(3, 20, 6),
  loop: z.boolean().default(true),
  showDots: z.boolean().default(true),
};

const sliderFields = [
  { kind: "text", prop: "label", label: "Name for screen readers" },
  {
    kind: "choice",
    prop: "perView",
    label: "Slides shown at once on computers",
    choices: [1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) })),
  },
  { kind: "toggle", prop: "showDots", label: "Show a dot for each slide" },
  { kind: "toggle", prop: "autoplay", label: "Move on by itself", advanced: true },
  {
    kind: "number",
    prop: "autoplaySeconds",
    label: "Seconds on each slide",
    min: 3,
    max: 20,
    unit: "s",
    advanced: true,
  },
  { kind: "toggle", prop: "loop", label: "Go back to the start after the last", advanced: true },
] as const;

export const carouselComponent = defineComponent({
  type: "carousel",
  label: "Slider",
  description:
    "Slides visitors move through with arrows, a swipe or the keyboard. It only moves by itself if you ask it to.",
  icon: "gallery-horizontal",
  category: "media",
  propsSchema: z.object(sliderProps),
  defaultProps: {
    label: "Slides",
    perView: 1,
    autoplay: false,
    autoplaySeconds: 6,
    loop: true,
    showDots: true,
  },
  defaultChildren: [
    { type: "slide", props: { label: "" } },
    { type: "slide", props: { label: "" } },
    { type: "slide", props: { label: "" } },
  ],
  allowedChildren: ["slide"],
  editableFields: sliderFields,
});

export const beforeAfterComponent = defineComponent({
  type: "beforeAfter",
  label: "Before and after",
  description: "Two pictures on top of each other, with a handle visitors drag to compare them.",
  icon: "split",
  category: "media",
  propsSchema: z.object({
    before: pictureSchema.default(emptyPicture),
    after: pictureSchema.default(emptyPicture),
    beforeLabel: plainText(60, "Before"),
    afterLabel: plainText(60, "After"),
    start: wholeNumber(0, 100, 50),
  }),
  defaultProps: {
    before: emptyPicture,
    after: emptyPicture,
    beforeLabel: "Before",
    afterLabel: "After",
    start: 50,
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "image", prop: "before", label: "Before picture" },
    { kind: "image", prop: "after", label: "After picture" },
    { kind: "text", prop: "beforeLabel", label: "Before label" },
    { kind: "text", prop: "afterLabel", label: "After label" },
    {
      kind: "number",
      prop: "start",
      label: "Where the handle starts",
      min: 0,
      max: 100,
      unit: "%",
      advanced: true,
    },
  ],
});

export const iconComponent = defineComponent({
  type: "icon",
  label: "Icon",
  description: "A small symbol from the built-in set, such as a star, a phone or an arrow.",
  icon: "star",
  category: "media",
  propsSchema: z.object({
    name: iconNameSchema.default("star"),
    label: plainText(120),
    size: oneOf(["medium", "small", "large", "extraLarge"], "The icon’s size"),
    motion: oneOf(["none", "spin", "pulse", "bounce"], "How the icon moves"),
  }),
  defaultProps: { name: "star", label: "", size: "medium", motion: "none" },
  allowedChildren: "none",
  editableFields: [
    { kind: "icon", prop: "name", label: "Icon" },
    {
      kind: "text",
      prop: "label",
      label: "What it means (leave empty if it’s decoration)",
    },
    {
      kind: "choice",
      prop: "size",
      label: "Size",
      choices: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
        { value: "extraLarge", label: "Very large" },
      ],
    },
    {
      kind: "choice",
      prop: "motion",
      label: "Movement",
      choices: [
        { value: "none", label: "Still" },
        { value: "spin", label: "Spins" },
        { value: "pulse", label: "Pulses" },
        { value: "bounce", label: "Bounces" },
      ],
      advanced: true,
    },
  ],
});

const logoSchema = z.object({
  image: pictureSchema.default(emptyPicture),
  href: linkAddressSchema.default(""),
});

export const logoStripComponent = defineComponent({
  type: "logoStrip",
  label: "Logo strip",
  description: "A row of logos, such as clients or partners. It can scroll slowly.",
  icon: "gallery-thumbnails",
  category: "media",
  propsSchema: z.object({
    title: plainText(200, "Trusted by"),
    logos: itemsOf(logoSchema, 60, "logos").default([]),
    scrolls: z.boolean().default(false),
    greyscale: z.boolean().default(true),
  }),
  defaultProps: { title: "Trusted by", logos: [], scrolls: false, greyscale: true },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "title", label: "Title above (optional)" },
    {
      kind: "itemList",
      prop: "logos",
      label: "Logos",
      itemLabel: "Logo",
      titleField: "image.alt",
      fields: [
        { kind: "image", prop: "image", label: "Logo (describe it with the company’s name)" },
        { kind: "link", prop: "href", label: "Links to (optional)" },
      ],
      newItem: { image: emptyPicture, href: "" },
      maxItems: 60,
    },
    { kind: "toggle", prop: "scrolls", label: "Scroll slowly sideways" },
    { kind: "toggle", prop: "greyscale", label: "Show in grey", advanced: true },
  ],
});

const coordinate = (limit: number, what: string) =>
  z
    .number({ error: `The ${what} should be a number` })
    .min(-limit, { error: `The ${what} should be between -${limit} and ${limit}` })
    .max(limit, { error: `The ${what} should be between -${limit} and ${limit}` });

export const mapComponent = defineComponent({
  type: "map",
  label: "Map",
  description:
    "A map from OpenStreetMap with a pin. It loads when a visitor asks for it; until then a link opens it.",
  icon: "map-pin",
  category: "media",
  propsSchema: z.object({
    placeName: plainText(200, "Our shop"),
    address: plainText(500),
    latitude: coordinate(90, "latitude").default(51.5074),
    longitude: coordinate(180, "longitude").default(-0.1278),
    zoom: wholeNumber(3, 19, 15),
  }),
  defaultProps: {
    placeName: "Our shop",
    address: "",
    latitude: 51.5074,
    longitude: -0.1278,
    zoom: 15,
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "placeName", label: "Name of the place" },
    { kind: "multilineText", prop: "address", label: "Address" },
    { kind: "number", prop: "latitude", label: "Latitude", min: -90, max: 90, step: 0.0001 },
    { kind: "number", prop: "longitude", label: "Longitude", min: -180, max: 180, step: 0.0001 },
    { kind: "number", prop: "zoom", label: "How close", min: 3, max: 19, advanced: true },
  ],
});

/** Sites an Embed may show. Anything else can be added with a code block. */
export const embedAllowedHosts = [
  "youtube-nocookie.com",
  "player.vimeo.com",
  "open.spotify.com",
  "w.soundcloud.com",
  "bandcamp.com",
  "codepen.io",
  "docs.google.com",
  "calendar.google.com",
  "calendly.com",
  "openstreetmap.org",
  "figma.com",
  "loom.com",
  "typeform.com",
  "airtable.com",
  "tally.so",
] as const;

export const embedComponent = defineComponent({
  type: "embed",
  label: "Embed",
  description:
    "Something from another website, such as a booking calendar, a playlist or a design. Visitors choose to load it.",
  icon: "app-window",
  category: "media",
  propsSchema: z.object({
    url: z
      .string()
      .trim()
      .max(2000)
      .refine((address) => isAllowedEmbedAddress(address, embedAllowedHosts), {
        error: `An embed should be an https:// address from one of: ${embedAllowedHosts.join(", ")}`,
      })
      .default(""),
    title: plainText(200, "Embedded content"),
    height: wholeNumber(120, 1600, 480),
    loadsStraightAway: z.boolean().default(false),
  }),
  defaultProps: { url: "", title: "Embedded content", height: 480, loadsStraightAway: false },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "url", label: "Embed address", placeholder: "https://calendly.com/…" },
    { kind: "text", prop: "title", label: "What it is" },
    {
      kind: "number",
      prop: "height",
      label: "Height",
      min: 120,
      max: 1600,
      unit: "px",
      advanced: true,
    },
    {
      kind: "toggle",
      prop: "loadsStraightAway",
      label: "Load without asking (only if your privacy notice allows it)",
      advanced: true,
    },
  ],
});
