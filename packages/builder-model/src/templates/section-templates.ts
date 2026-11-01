import type { NodeBlueprint } from "../components/component-definition.js";

/**
 * Ready-made sections for the Insert panel and the empty-page start: sensible layouts made of
 * ordinary elements, so everything in them can be changed like anything else on the page.
 */
export interface SectionTemplate {
  id: string;
  label: string;
  /** One plain sentence: what the section is good for. */
  description: string;
  blueprint: NodeBlueprint;
}

const space = (step: number) => `var(--lintel-space-${step})`;

const container = (
  children: NodeBlueprint[],
  extra: Record<string, string> = {},
): NodeBlueprint => ({
  type: "container",
  styles: {
    base: {
      display: "flex",
      flexDirection: "column",
      gap: space(5),
      maxWidth: "72rem",
      marginLeft: "auto",
      marginRight: "auto",
      width: "100%",
      ...extra,
    },
  },
  children,
});

const card = (heading: string, text: string): NodeBlueprint => ({
  type: "box",
  name: "Feature",
  props: { element: "article" },
  styles: {
    base: {
      display: "flex",
      flexDirection: "column",
      gap: space(3),
      paddingTop: space(5),
      paddingBottom: space(5),
      paddingLeft: space(5),
      paddingRight: space(5),
      backgroundColor: "var(--lintel-color-surface)",
      borderRadius: "var(--lintel-radius-medium)",
    },
  },
  children: [
    { type: "heading", props: { text: heading, level: 3 } },
    { type: "text", props: { text } },
  ],
});

export const sectionTemplates: readonly SectionTemplate[] = [
  {
    id: "hero",
    label: "Hero",
    description: "A big welcome at the top of the page: a title, a line about you and a button.",
    blueprint: {
      type: "section",
      name: "Hero",
      children: [
        container(
          [
            {
              type: "heading",
              name: "Hero title",
              props: { text: "Good things, made well", level: 1 },
            },
            {
              type: "text",
              props: { text: "Say in a sentence or two what you do and who it’s for." },
            },
            { type: "button", props: { label: "Get in touch", href: "/contact" } },
          ],
          { alignItems: "center", textAlign: "center", maxWidth: "48rem" },
        ),
      ],
    },
  },
  {
    id: "features",
    label: "Three features",
    description: "Three short points side by side, such as what makes you different.",
    blueprint: {
      type: "section",
      name: "Features",
      children: [
        container([
          { type: "heading", props: { text: "Why people choose us", level: 2 } },
          {
            type: "columns",
            styles: {
              base: {
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: space(5),
              },
              tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
              phone: { gridTemplateColumns: "minmax(0, 1fr)" },
            },
            children: [
              card("Friendly", "Explain the first thing people love about you."),
              card("Fast", "And the second, in a sentence or two."),
              card("Local", "And a third, to round it off."),
            ],
          },
        ]),
      ],
    },
  },
  {
    id: "text-and-picture",
    label: "Text beside a picture",
    description: "A heading and a few lines next to a photo. On phones the photo goes underneath.",
    blueprint: {
      type: "section",
      name: "Story",
      children: [
        container([
          {
            type: "columns",
            styles: {
              base: {
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: space(7),
                alignItems: "center",
              },
              phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
            },
            children: [
              {
                type: "box",
                name: "Story text",
                children: [
                  { type: "heading", props: { text: "Our story", level: 2 } },
                  {
                    type: "text",
                    props: { text: "Tell visitors how you started and what you care about." },
                  },
                  { type: "link", props: { label: "Meet the team", href: "/about" } },
                ],
              },
              { type: "image", props: { alt: "" } },
            ],
          },
        ]),
      ],
    },
  },
  {
    id: "testimonial",
    label: "Customer quote",
    description: "A kind word from a customer, big and centred.",
    blueprint: {
      type: "section",
      name: "Testimonial",
      styles: {
        base: {
          paddingTop: space(8),
          paddingBottom: space(8),
          paddingLeft: space(5),
          paddingRight: space(5),
          backgroundColor: "var(--lintel-color-surface)",
        },
      },
      children: [
        container(
          [
            {
              type: "quote",
              styles: { base: { fontSize: "1.5rem", lineHeight: "1.4" } },
              props: {
                text: "They were a joy to work with, and the results speak for themselves.",
                citation: "Alex, a happy customer",
              },
            },
          ],
          { maxWidth: "44rem", textAlign: "center" },
        ),
      ],
    },
  },
  {
    id: "call-to-action",
    label: "Call to action",
    description: "A short invitation with a button, in your brand colour.",
    blueprint: {
      type: "section",
      name: "Call to action",
      styles: {
        base: {
          paddingTop: space(8),
          paddingBottom: space(8),
          paddingLeft: space(5),
          paddingRight: space(5),
          backgroundColor: "var(--lintel-color-brand)",
          color: "var(--lintel-color-on-brand)",
        },
      },
      children: [
        container(
          [
            { type: "heading", props: { text: "Ready when you are", level: 2 } },
            { type: "text", props: { text: "Book a free call and we’ll talk it through." } },
            {
              type: "button",
              props: { label: "Book a call", href: "/contact" },
              styles: {
                base: {
                  display: "inline-block",
                  paddingTop: space(3),
                  paddingBottom: space(3),
                  paddingLeft: space(5),
                  paddingRight: space(5),
                  backgroundColor: "var(--lintel-color-on-brand)",
                  color: "var(--lintel-color-brand)",
                  borderRadius: "var(--lintel-radius-button)",
                  fontWeight: "600",
                  textDecoration: "none",
                  alignSelf: "center",
                },
                hover: { opacity: "0.88" },
              },
            },
          ],
          { alignItems: "center", textAlign: "center", maxWidth: "40rem" },
        ),
      ],
    },
  },
  {
    id: "questions",
    label: "Questions and answers",
    description: "Common questions with short answers, so visitors don’t have to ask.",
    blueprint: {
      type: "section",
      name: "Questions",
      children: [
        container(
          [
            { type: "heading", props: { text: "Questions people ask", level: 2 } },
            { type: "heading", props: { text: "How long does it take?", level: 3 } },
            {
              type: "text",
              props: { text: "Most projects take two to four weeks from the first call." },
            },
            { type: "divider" },
            { type: "heading", props: { text: "What does it cost?", level: 3 } },
            {
              type: "text",
              props: { text: "Prices start at a fixed fee; we’ll agree it before we start." },
            },
          ],
          { maxWidth: "48rem" },
        ),
      ],
    },
  },
];

export function findSectionTemplate(templateId: string): SectionTemplate | undefined {
  return sectionTemplates.find((template) => template.id === templateId);
}
