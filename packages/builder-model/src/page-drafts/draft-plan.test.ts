import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createEmptyPage } from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { sectionsFromDraftPlan } from "./draft-plan-sections.js";
import {
  type DraftPlan,
  type DraftSection,
  draftPlanJsonSchema,
  draftSectionKinds,
  readDraftPlan,
  rewriteSchema,
} from "./draft-plan.js";

const point = (heading: string) => ({ heading, text: `${heading}, in a sentence.` });

/** One of every kind, as a model might write them for a bakery. */
const everyKind: DraftSection[] = [
  {
    kind: "welcome",
    heading: "Bread worth getting up for",
    text: "Baked at dawn.",
    button: "Visit",
  },
  {
    kind: "welcome-with-picture",
    label: "Since 1998",
    heading: "A corner bakery",
    text: "Sourdough, buns and cakes.",
    button: "See the menu",
  },
  { kind: "page-title", label: "Menu", heading: "What we bake", text: "Every day, by hand." },
  {
    kind: "features",
    heading: "Why people come back",
    text: "Three small reasons.",
    points: [point("Slow dough"), point("Local flour"), point("Friendly faces")],
  },
  {
    kind: "steps",
    heading: "Ordering a cake",
    points: [point("Ask"), point("Taste"), point("Collect")],
  },
  {
    kind: "story",
    heading: "Our story",
    text: "It began with one oven.",
    points: ["Family run", "Open six days", "Flour from the next village"],
  },
  {
    kind: "quotes",
    heading: "Kind words",
    quotes: [{ words: "The best loaf in town." }, { words: "Lovely staff." }, { words: "Yum." }],
  },
  {
    kind: "prices",
    heading: "Cake prices",
    text: "Each serves about ten.",
    plans: [
      { name: "Small", price: "[price]", description: "For a few.", includes: "Sponge; Icing" },
      { name: "Large", price: "[price]", description: "For a party.", includes: "Two layers" },
    ],
  },
  {
    kind: "questions",
    heading: "Questions",
    items: [
      { question: "Do you deliver?", answer: "Nearby, yes." },
      { question: "Gluten free?", answer: "Some days." },
      { question: "Can I order ahead?", answer: "Yes, call us." },
    ],
  },
  { kind: "call-to-action", heading: "Hungry?", text: "Come by today.", button: "Find us" },
  { kind: "quiet-call-to-action", heading: "Questions?", text: "Ask away.", button: "Write to us" },
];

function everyNode(blueprint: NodeBlueprint): NodeBlueprint[] {
  return [blueprint, ...(blueprint.children ?? []).flatMap(everyNode)];
}

/** Every string in the sections' props, lists included. */
function wordsIn(blueprints: readonly NodeBlueprint[]): string[] {
  const strings = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(strings)
        : typeof value === "object" && value !== null
          ? Object.values(value).flatMap(strings)
          : [];
  return blueprints.flatMap(everyNode).flatMap((node) => strings(node.props));
}

describe("a drafted page's plan", () => {
  it("covers every kind of section", () => {
    expect(everyKind.map((section) => section.kind)).toEqual(draftSectionKinds);
  });

  it("accepts a well-formed plan and trims the words", () => {
    const plan = readDraftPlan({
      sections: [{ kind: "welcome", heading: "  Hello  ", text: "Hi.", button: "Go" }],
    });
    expect(plan?.sections[0]).toMatchObject({ heading: "Hello" });
  });

  it("refuses kinds it doesn't know, missing words, empty words and too many points", () => {
    expect(readDraftPlan({ sections: [{ kind: "gallery", heading: "Pictures" }] })).toBeNull();
    expect(readDraftPlan({ sections: [{ kind: "welcome", heading: "Hello" }] })).toBeNull();
    expect(
      readDraftPlan({ sections: [{ kind: "welcome", heading: " ", text: "Hi", button: "Go" }] }),
    ).toBeNull();
    expect(
      readDraftPlan({
        sections: [
          { kind: "features", heading: "Why", text: "Because", points: [1, 2, 3, 4].map(String) },
        ],
      }),
    ).toBeNull();
    expect(readDraftPlan({ sections: [] })).toBeNull();
    expect(readDraftPlan("not a plan")).toBeNull();
  });

  it("refuses words longer than their place allows", () => {
    expect(
      readDraftPlan({
        sections: [{ kind: "welcome", heading: "x".repeat(91), text: "Hi", button: "Go" }],
      }),
    ).toBeNull();
    expect(rewriteSchema.safeParse({ text: "x".repeat(1201) }).success).toBe(false);
  });
});

describe("the plan's JSON schema for the writing model", () => {
  it("holds the model to the chosen sections, in order", () => {
    const schema = draftPlanJsonSchema(["welcome", "questions"]);
    const sections = (schema.properties as Record<string, Record<string, unknown>>).sections;
    expect(sections).toMatchObject({ type: "array", minItems: 2, maxItems: 2 });
    const kinds = (sections?.prefixItems as Array<{ properties: { kind: { const: string } } }>).map(
      (item) => item.properties.kind.const,
    );
    expect(kinds).toEqual(["welcome", "questions"]);
  });

  it("lets the model choose three to six of any kind without a choice", () => {
    const schema = draftPlanJsonSchema();
    const sections = (schema.properties as Record<string, Record<string, unknown>>).sections;
    expect(sections).toMatchObject({ minItems: 3, maxItems: 6 });
    expect((sections?.items as { oneOf: unknown[] }).oneOf).toHaveLength(draftSectionKinds.length);
  });

  it("asks for every field the checked plan needs, and no others", () => {
    const schema = draftPlanJsonSchema(["prices"]);
    const sections = (schema.properties as Record<string, Record<string, unknown>>).sections;
    const prices = (sections?.prefixItems as Array<Record<string, unknown>>)[0];
    expect(prices).toMatchObject({
      required: ["kind", "heading", "text", "plans"],
      additionalProperties: false,
    });
  });

  it("only uses what llama.cpp's grammar understands", () => {
    const understood = new Set([
      "type",
      "properties",
      "required",
      "additionalProperties",
      "items",
      "prefixItems",
      "minItems",
      "maxItems",
      "minLength",
      "maxLength",
      "oneOf",
      "const",
    ]);
    const keys = (value: unknown, inProperties = false): string[] => {
      if (Array.isArray(value)) return value.flatMap((item) => keys(item));
      if (typeof value !== "object" || value === null) return [];
      return Object.entries(value).flatMap(([key, inner]) => [
        ...(inProperties ? [] : [key]),
        ...keys(inner, key === "properties"),
      ]);
    };
    const used = new Set([...keys(draftPlanJsonSchema()), ...keys(draftPlanJsonSchema(["story"]))]);
    expect([...used].filter((key) => !understood.has(key))).toEqual([]);
  });
});

describe("turning a plan into sections", () => {
  const plan: DraftPlan = { sections: everyKind };
  const blueprints = sectionsFromDraftPlan(plan);

  it("makes one ordinary section for each part of the plan", () => {
    expect(blueprints).toHaveLength(everyKind.length);
    for (const blueprint of blueprints) expect(blueprint.type).toBe("section");
  });

  it("makes sections a page can hold, that pass the page checks", () => {
    const createId = createCountingNodeIds();
    const page = createEmptyPage();
    const children = blueprints.map((blueprint) =>
      createNode(blueprint, standardCatalogue, createId),
    );
    const result = validatePageDocument(
      { ...page, root: { ...page.root, children } },
      standardCatalogue,
    );
    expect(result.ok).toBe(true);
  });

  it("puts the drafted words on the page", () => {
    const words = wordsIn(blueprints);
    expect(words).toEqual(
      expect.arrayContaining([
        "Bread worth getting up for",
        "Do you deliver?",
        "Flour from the next village",
        "The best loaf in town.",
        "Sponge",
        "Icing",
      ]),
    );
  });

  it("leaves buttons for people to point somewhere, and quotes unattributed", () => {
    const nodes = blueprints.flatMap(everyNode);
    const hrefs = nodes.filter((node) => node.type === "button").map((node) => node.props?.href);
    expect(new Set(hrefs)).toEqual(new Set(["#"]));
    expect(wordsIn(blueprints)).toContain("Customer name");
  });

  it("uses the library's illustrations for pictures, taking turns", () => {
    const pictures = blueprints
      .flatMap(everyNode)
      .map((node) => node.props?.src)
      .filter((src): src is string => typeof src === "string" && src.includes("/illustrations/"));
    expect(pictures).toEqual([
      "/_lintel/illustrations/abstract-hills.svg",
      "/_lintel/illustrations/abstract-window.svg",
    ]);
  });
});
