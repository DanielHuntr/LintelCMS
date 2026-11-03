import { z } from "zod";

/**
 * A drafted page's plan: the sections it has, in order, each with its words. The writing
 * model on the server fills this in (held to `draftPlanJsonSchema` while it writes), the
 * server checks it with `draftPlanSchema`, and the builder turns it into ordinary sections
 * with `sectionsFromDraftPlan`.
 *
 * Each kind of section is one of the section library's own builders (src/sections), so a
 * drafted page is made of the same parts, styled by the same theme tokens and site styles,
 * as a page put together by hand. There are no pictures, links or numbers to invent: only
 * words, which people are asked to check before they publish.
 *
 * Both schemas are made from one table (`draftSectionFields`), so they can't drift apart.
 */

/** Lengths keep the words short enough for their place, and the writing quick. */
const lengths = { label: 40, heading: 90, sentence: 320 } as const;

type WordsField = { wordLength: keyof typeof lengths };
type ListField = {
  list: Readonly<Record<string, WordsField>> | WordsField;
  fewest: number;
  most: number;
};
type DraftField = WordsField | ListField;

const words = (length: keyof typeof lengths): WordsField => ({ wordLength: length });
const points = (fewest: number, most: number) => ({
  list: { heading: words("heading"), text: words("sentence") },
  fewest,
  most,
});

/**
 * Every kind of section a draft may have, and the words each one needs. The order here is
 * the order the draft form offers them in, and a sensible order for a page.
 */
export const draftSectionFields = {
  welcome: { heading: words("heading"), text: words("sentence"), button: words("label") },
  "welcome-with-picture": {
    label: words("label"),
    heading: words("heading"),
    text: words("sentence"),
    button: words("label"),
  },
  "page-title": { label: words("label"), heading: words("heading"), text: words("sentence") },
  features: { heading: words("heading"), text: words("sentence"), points: points(3, 3) },
  steps: { heading: words("heading"), points: points(3, 4) },
  story: {
    heading: words("heading"),
    text: words("sentence"),
    points: { list: words("heading"), fewest: 3, most: 3 },
  },
  quotes: {
    heading: words("heading"),
    quotes: { list: { words: words("sentence") }, fewest: 3, most: 3 },
  },
  prices: {
    heading: words("heading"),
    text: words("sentence"),
    plans: {
      list: {
        name: words("label"),
        price: words("label"),
        description: words("sentence"),
        includes: words("sentence"),
      },
      fewest: 2,
      most: 3,
    },
  },
  questions: {
    heading: words("heading"),
    items: { list: { question: words("heading"), answer: words("sentence") }, fewest: 3, most: 5 },
  },
  "call-to-action": { heading: words("heading"), text: words("sentence"), button: words("label") },
  "quiet-call-to-action": {
    heading: words("heading"),
    text: words("sentence"),
    button: words("label"),
  },
} as const satisfies Record<string, Readonly<Record<string, DraftField>>>;

export type DraftSectionKind = keyof typeof draftSectionFields;
export const draftSectionKinds = Object.keys(draftSectionFields) as DraftSectionKind[];

/** The most sections a draft may have, so writing one stays within a couple of minutes. */
export const MOST_DRAFT_SECTIONS = 7;
/** Without a choice of sections, the model picks between these many. */
const FEWEST_CHOSEN_BY_MODEL = 3;
const MOST_CHOSEN_BY_MODEL = 6;

function isWords(field: DraftField | Readonly<Record<string, WordsField>>): field is WordsField {
  return "wordLength" in field;
}

function zodFor(field: DraftField): z.ZodType {
  if (isWords(field)) return z.string().trim().min(1).max(lengths[field.wordLength]);
  const item = isWords(field.list)
    ? zodFor(field.list)
    : z.object(mapValues(field.list, (inner) => zodFor(inner)));
  return z.array(item).min(field.fewest).max(field.most);
}

function mapValues<Value, Result>(
  record: Readonly<Record<string, Value>>,
  change: (value: Value) => Result,
): Record<string, Result> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, change(value)]));
}

const sectionSchemas = draftSectionKinds.map((kind) =>
  z.object({
    kind: z.literal(kind),
    ...mapValues(draftSectionFields[kind] as Readonly<Record<string, DraftField>>, zodFor),
  }),
);

/** One drafted section, as checked. Its fields depend on its `kind`. */
export const draftSectionSchema = z.discriminatedUnion(
  "kind",
  sectionSchemas as unknown as readonly [
    (typeof sectionSchemas)[number],
    ...(typeof sectionSchemas)[number][],
  ],
);

export const draftPlanSchema = z.object({
  sections: z.array(draftSectionSchema).min(1).max(MOST_DRAFT_SECTIONS),
});

/** What one field holds once written: words, or a list of words or of small groups. */
type FieldValue<Field> = Field extends WordsField
  ? string
  : Field extends { list: infer Item }
    ? Array<
        Item extends WordsField ? string : { -readonly [Key in keyof Item]: FieldValue<Item[Key]> }
      >
    : never;

/** One drafted section's words, by kind, worked out from `draftSectionFields`. */
export type DraftSection = {
  [Kind in DraftSectionKind]: { kind: Kind } & {
    -readonly [Key in keyof (typeof draftSectionFields)[Kind]]: FieldValue<
      (typeof draftSectionFields)[Kind][Key]
    >;
  };
}[DraftSectionKind];

export interface DraftPlan {
  sections: DraftSection[];
}

/**
 * Checks what the model wrote. Null when it isn't a plan: the server then says the draft
 * didn't work out, rather than putting something half-formed on the page.
 */
export function readDraftPlan(value: unknown): DraftPlan | null {
  const parsed = draftPlanSchema.safeParse(value);
  return parsed.success ? (parsed.data as DraftPlan) : null;
}

/**
 * A JSON schema for the plan, in the plain subset llama.cpp's grammar understands (every
 * property required, `oneOf`, `const`, lengths and counts). The model can only write text
 * that fits it, so its answer always has this shape.
 *
 * With `kinds`, the plan has exactly those sections in that order: people choose the
 * sections, the model writes their words. Without, it picks three to six itself.
 */
export function draftPlanJsonSchema(kinds?: readonly DraftSectionKind[]): JsonSchema {
  const chosen = kinds && kinds.length > 0 ? kinds.slice(0, MOST_DRAFT_SECTIONS) : undefined;
  const sections: JsonSchema = chosen
    ? {
        type: "array",
        prefixItems: chosen.map(sectionJsonSchema),
        minItems: chosen.length,
        maxItems: chosen.length,
      }
    : {
        type: "array",
        items: { oneOf: draftSectionKinds.map(sectionJsonSchema) },
        minItems: FEWEST_CHOSEN_BY_MODEL,
        maxItems: MOST_CHOSEN_BY_MODEL,
      };
  return {
    type: "object",
    properties: { sections },
    required: ["sections"],
    additionalProperties: false,
  };
}

/** The shape of the JSON schemas made here: plain data, nothing a model runner must import. */
export type JsonSchema = { readonly [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonSchema;

function sectionJsonSchema(kind: DraftSectionKind): JsonSchema {
  const fields = draftSectionFields[kind] as Readonly<Record<string, DraftField>>;
  return objectSchema({ kind: { const: kind }, ...mapValues(fields, fieldJsonSchema) });
}

function fieldJsonSchema(field: DraftField): JsonSchema {
  if (isWords(field)) return { type: "string", minLength: 1, maxLength: lengths[field.wordLength] };
  return {
    type: "array",
    items: isWords(field.list)
      ? fieldJsonSchema(field.list)
      : objectSchema(mapValues(field.list, fieldJsonSchema)),
    minItems: field.fewest,
    maxItems: field.most,
  };
}

function objectSchema(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

/** "Rewrite this": the new words, and nothing else. */
export const MOST_REWRITE_CHARACTERS = 1200;
export const rewriteJsonSchema: JsonSchema = objectSchema({
  text: { type: "string", minLength: 1, maxLength: MOST_REWRITE_CHARACTERS },
});
export const rewriteSchema = z.object({
  text: z.string().trim().min(1).max(MOST_REWRITE_CHARACTERS),
});
