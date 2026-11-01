import { z } from "zod";
import { pageFontsSchema } from "../fonts/page-fonts.js";
import { defineComponent } from "./component-definition.js";

/** The page itself, sections, boxes and columns: the elements that hold other elements. */

export const pageComponent = defineComponent({
  type: "page",
  label: "Page",
  description: "The whole page.",
  icon: "file",
  category: "layout",
  propsSchema: z.object({
    // The fonts the page adds to the theme's (see fonts/page-fonts.ts).
    fonts: pageFontsSchema,
    /**
     * A collection's handle when this page is the design every entry of that collection is
     * shown with (a blog post design); its elements show the entry's fields.
     */
    itemDesignFor: z
      .string()
      .regex(/^([a-z0-9][a-z0-9_:-]{0,63})?$/, { error: "Choose a collection by its handle" })
      .default(""),
  }),
  defaultProps: { fonts: [], itemDesignFor: "" },
  allowedChildren: "any",
  editableFields: [
    {
      kind: "source",
      source: "collections",
      prop: "itemDesignFor",
      label: "Use this page as the design of every entry in",
    },
  ],
  hiddenFromInsert: true,
});

export const sectionElements = ["section", "header", "footer", "aside", "article"] as const;

export const sectionComponent = defineComponent({
  type: "section",
  label: "Section",
  description:
    "A band across the page that groups related content, like a hero or a list of features.",
  icon: "rows-3",
  category: "layout",
  propsSchema: z.object({
    element: z
      .enum(sectionElements, {
        error: "A section should be a section, header, footer, aside or article",
      })
      .default("section"),
    anchor: z
      .string()
      .regex(/^([A-Za-z][\w-]{0,63})?$/, {
        error: "An anchor can only have letters, numbers, - and _",
      })
      .default(""),
  }),
  defaultProps: { element: "section", anchor: "" },
  defaultStyles: {
    base: {
      paddingTop: "var(--lintel-space-8)",
      paddingBottom: "var(--lintel-space-8)",
      paddingLeft: "var(--lintel-space-5)",
      paddingRight: "var(--lintel-space-5)",
    },
    phone: { paddingTop: "var(--lintel-space-7)", paddingBottom: "var(--lintel-space-7)" },
  },
  allowedChildren: "any",
  editableFields: [
    {
      kind: "choice",
      prop: "element",
      label: "What this section is",
      choices: [
        { value: "section", label: "A section of the page" },
        { value: "header", label: "The page’s header" },
        { value: "footer", label: "The page’s footer" },
        { value: "aside", label: "Something on the side" },
        { value: "article", label: "A self-contained article" },
      ],
    },
    { kind: "text", prop: "anchor", label: "Anchor for links (#name)", placeholder: "pricing" },
  ],
});

export const boxElements = [
  "div",
  "header",
  "footer",
  "nav",
  "article",
  "aside",
  "ul",
  "ol",
  "li",
] as const;

export const boxComponent = defineComponent({
  type: "box",
  label: "Box",
  description: "A container that groups and arranges the elements inside it.",
  icon: "square",
  category: "layout",
  propsSchema: z.object({
    element: z
      .enum(boxElements, {
        error: "A box should be a div, header, footer, nav, article, aside or list",
      })
      .default("div"),
  }),
  defaultProps: { element: "div" },
  defaultStyles: {
    base: { display: "flex", flexDirection: "column", gap: "var(--lintel-space-4)" },
  },
  allowedChildren: "any",
  editableFields: [
    {
      kind: "choice",
      prop: "element",
      label: "What this box is",
      choices: [
        { value: "div", label: "Just a box" },
        { value: "header", label: "A header" },
        { value: "footer", label: "A footer" },
        { value: "nav", label: "Navigation" },
        { value: "article", label: "An article or card" },
        { value: "aside", label: "Something on the side" },
        { value: "ul", label: "A list" },
        { value: "ol", label: "A numbered list" },
        { value: "li", label: "A list item" },
      ],
    },
  ],
});

/** A centred, readable width for the content of a section. */
export const containerComponent = defineComponent({
  type: "container",
  label: "Container",
  description: "Keeps what’s inside to a comfortable reading width, centred on wide screens.",
  icon: "panel-top",
  category: "layout",
  propsSchema: z.object({}),
  defaultProps: {},
  defaultStyles: {
    base: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--lintel-space-5)",
      maxWidth: "72rem",
      marginLeft: "auto",
      marginRight: "auto",
      width: "100%",
    },
  },
  allowedChildren: "any",
  editableFields: [],
});

export const columnsComponent = defineComponent({
  type: "columns",
  label: "Columns",
  description: "Puts things side by side. On phones they stack, one under another.",
  icon: "columns-2",
  category: "layout",
  propsSchema: z.object({}),
  defaultProps: {},
  defaultStyles: {
    base: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "var(--lintel-space-6)",
    },
    phone: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  defaultChildren: [
    { type: "box", name: "Column" },
    { type: "box", name: "Column" },
  ],
  allowedChildren: "any",
  editableFields: [],
});
