import { z } from "zod";
import { defineComponent, type EditableField } from "./component-definition.js";
import { imageAddressSchema, linkAddressSchema, plainText } from "./component-props.js";

/**
 * The site's ready-made blocks (Hero, Call to action, Text, Picture, Question), drawn by
 * `@lintel/site-components` exactly as on the published site. Each is one element in the
 * builder: its content is filled in from the Content panel, and the element itself can be
 * moved, styled (as a whole), hidden and duplicated like any other.
 */

const pictureProps = {
  src: imageAddressSchema.default(""),
  alt: plainText(500),
  assetId: z.string().max(100).nullable().default(null),
};

const pictureFields: readonly EditableField[] = [
  { kind: "image", prop: "src", label: "Picture" },
  { kind: "multilineText", prop: "alt", label: "Describe the picture" },
];

const buttonFields: readonly EditableField[] = [
  { kind: "text", prop: "buttonLabel", label: "Words on the button" },
  { kind: "link", prop: "buttonHref", label: "Where the button goes" },
];

export const heroBlockComponent = defineComponent({
  type: "heroBlock",
  label: "Hero",
  description: "The site’s big opening: a title, a line or two, a button and a picture.",
  icon: "panel-top",
  category: "blocks",
  propsSchema: z.object({
    heading: plainText(500, "Welcome"),
    subheading: plainText(2000),
    buttonLabel: plainText(200),
    buttonHref: linkAddressSchema.default(""),
    isPageTitle: z.boolean().default(true),
    ...pictureProps,
  }),
  defaultProps: {
    heading: "Welcome",
    subheading: "Say in a sentence or two what you do and who it’s for.",
    buttonLabel: "Get in touch",
    buttonHref: "/contact",
    isPageTitle: true,
    src: "",
    alt: "",
    assetId: null,
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "heading", label: "Title" },
    { kind: "multilineText", prop: "subheading", label: "A line or two under it" },
    ...buttonFields,
    ...pictureFields,
    { kind: "toggle", prop: "isPageTitle", label: "This is the page’s main title" },
  ],
});

export const callToActionBlockComponent = defineComponent({
  type: "callToActionBlock",
  label: "Call to action",
  description: "A short invitation with a button, such as “Book a call”, on a soft background.",
  icon: "mouse-pointer-click",
  category: "blocks",
  propsSchema: z.object({
    heading: plainText(500, "Ready when you are"),
    text: plainText(2000),
    buttonLabel: plainText(200),
    buttonHref: linkAddressSchema.default(""),
  }),
  defaultProps: {
    heading: "Ready when you are",
    text: "Book a free call and we’ll talk it through.",
    buttonLabel: "Book a call",
    buttonHref: "/contact",
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "heading", label: "Title" },
    { kind: "multilineText", prop: "text", label: "Text" },
    ...buttonFields,
  ],
});

export const textBlockComponent = defineComponent({
  type: "textBlock",
  label: "Text section",
  description: "A heading and paragraphs at a comfortable reading width.",
  icon: "pilcrow",
  category: "blocks",
  propsSchema: z.object({
    heading: plainText(500),
    text: plainText(20000, "Write something here."),
  }),
  defaultProps: {
    heading: "About us",
    text: "Write a few paragraphs here.\n\nLeave an empty line between paragraphs.",
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "heading", label: "Heading" },
    { kind: "multilineText", prop: "text", label: "Text (an empty line starts a new paragraph)" },
  ],
});

export const imageBlockComponent = defineComponent({
  type: "imageBlock",
  label: "Picture section",
  description: "A picture across the page, with an optional caption.",
  icon: "image",
  category: "blocks",
  propsSchema: z.object({ ...pictureProps, caption: plainText(500) }),
  defaultProps: { src: "", alt: "", assetId: null, caption: "" },
  allowedChildren: "none",
  editableFields: [...pictureFields, { kind: "text", prop: "caption", label: "Caption" }],
});

export const questionBlockComponent = defineComponent({
  type: "questionBlock",
  label: "Question and answer",
  description: "A question that opens to show its answer. Add one for each question.",
  icon: "list",
  category: "blocks",
  propsSchema: z.object({
    question: plainText(500, "What do you offer?"),
    answer: plainText(5000),
  }),
  defaultProps: { question: "What do you offer?", answer: "A short, friendly answer." },
  allowedChildren: "none",
  editableFields: [
    { kind: "text", prop: "question", label: "Question" },
    { kind: "multilineText", prop: "answer", label: "Answer" },
  ],
});
