import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import { oneOf, plainText, wholeNumber } from "./component-props.js";

/**
 * Lists that fill themselves from a collection, such as the latest blog posts. Whatever is
 * inside the list is its item design, drawn once per entry; elements in it show the entry's
 * fields through "Show a field" in the Content panel (their `bindings`).
 */

const handleSchema = z
  .string()
  .regex(/^([a-z0-9][a-z0-9_-]{0,63})?$/, { error: "A collection should be chosen by its handle" })
  .default("");

export const collectionListSorts = [
  "newest",
  "oldest",
  "titleAToZ",
  "titleZToA",
  "manual",
] as const;
export type CollectionListSort = (typeof collectionListSorts)[number];

export const collectionListComponent = defineComponent({
  type: "collectionList",
  label: "Collection list",
  description:
    "Entries from a collection, such as your latest blog posts, each drawn with a design you make once.",
  icon: "library",
  category: "collections",
  propsSchema: z.object({
    collection: handleSchema,
    term: z
      .string()
      .regex(/^([a-z0-9_-]{1,64}\/[^/\s]{1,200})?$/, {
        error: "A filter should be a taxonomy and a term",
      })
      .default(""),
    sort: oneOf(collectionListSorts, "The order"),
    limit: wholeNumber(1, 100, 6),
    paginate: z.boolean().default(false),
    columns: wholeNumber(1, 6, 3),
    tabletColumns: wholeNumber(1, 6, 2),
    phoneColumns: wholeNumber(1, 6, 1),
    emptyText: plainText(300, "Nothing here yet. Check back soon."),
    skipCurrent: z.boolean().default(true),
  }),
  defaultProps: {
    collection: "",
    term: "",
    sort: "newest",
    limit: 6,
    paginate: false,
    columns: 3,
    tabletColumns: 2,
    phoneColumns: 1,
    emptyText: "Nothing here yet. Check back soon.",
    skipCurrent: true,
  },
  defaultChildren: [
    {
      type: "card",
      name: "Item design",
      bindings: { href: "url" },
      children: [
        { type: "image", bindings: { src: "image" } },
        {
          type: "text",
          name: "Date",
          props: { text: "1 January 2027" },
          bindings: { text: "publishedAt" },
        },
        { type: "heading", props: { text: "Entry title", level: 3 }, bindings: { text: "title" } },
        {
          type: "text",
          props: { text: "A short summary of the entry." },
          bindings: { text: "excerpt" },
        },
      ],
    },
  ],
  allowedChildren: "any",
  editableFields: [
    { kind: "source", source: "collections", prop: "collection", label: "Collection" },
    {
      kind: "source",
      source: "terms",
      prop: "term",
      label: "Only entries filed under",
      dependsOn: "collection",
    },
    {
      kind: "choice",
      prop: "sort",
      label: "Order",
      choices: [
        { value: "newest", label: "Newest first" },
        { value: "oldest", label: "Oldest first" },
        { value: "titleAToZ", label: "By title, A to Z" },
        { value: "titleZToA", label: "By title, Z to A" },
        { value: "manual", label: "The collection’s own order" },
      ],
    },
    { kind: "number", prop: "limit", label: "How many to show", min: 1, max: 100 },
    { kind: "toggle", prop: "paginate", label: "Link to more pages when there are more" },
    { kind: "multilineText", prop: "emptyText", label: "What to say when there are none" },
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
      kind: "toggle",
      prop: "skipCurrent",
      label: "Leave out the entry being shown",
      advanced: true,
    },
  ],
});
