import type { NodeBlueprint } from "../components/component-definition.js";
import {
  animate,
  button,
  card,
  colour,
  container,
  grid,
  heading,
  list,
  quote,
  section,
  text,
} from "./section-parts.js";

/** What customers say, and what things cost. */

export interface Testimonial {
  words: string;
  name: string;
}

/** One kind word, big and centred. */
export function singleQuote(testimonial: Testimonial): NodeBlueprint {
  return section(
    "Testimonial",
    [
      container(
        [
          {
            ...quote(testimonial.words, testimonial.name),
            styles: { base: { fontSize: "1.5rem", lineHeight: "1.4" } },
            animation: animate("fade-up"),
          },
        ],
        { width: "44rem", centred: true },
      ),
    ],
    { tone: "panel" },
  );
}

/** Three quotes in cards. */
export function quoteCards(copy: { heading: string; quotes: Testimonial[] }): NodeBlueprint {
  return section(
    "Testimonials",
    [
      container([
        heading(copy.heading, 2),
        grid(
          Math.min(copy.quotes.length, 3),
          copy.quotes.map((testimonial) =>
            card("Quote", [quote(testimonial.words, testimonial.name)], { tone: "page" }),
          ),
          { animation: animate("stagger-up", { stagger: 120 }) },
        ),
      ]),
    ],
    { tone: "panel" },
  );
}

export interface Plan {
  name: string;
  price: string;
  description: string;
  includes: string[];
  button: { label: string; href: string };
  highlighted?: boolean;
}

/** Plans side by side; the highlighted one is in the brand colour. */
export function pricing(copy: { heading: string; text?: string; plans: Plan[] }): NodeBlueprint {
  return section("Pricing", [
    container([
      container([heading(copy.heading, 2), ...(copy.text ? [text(copy.text)] : [])], {
        width: "40rem",
        centred: true,
        gap: 3,
      }),
      grid(
        Math.min(copy.plans.length, 3),
        copy.plans.map((plan) =>
          card(
            plan.highlighted ? "Recommended plan" : "Plan",
            [
              heading(plan.name, 3),
              {
                type: "text",
                name: "Price",
                props: { text: plan.price },
                styles: { base: { fontSize: "2.25rem", fontWeight: "700", lineHeight: "1.1" } },
              },
              text(plan.description),
              list(plan.includes),
              button(plan.button.label, plan.button.href, plan.highlighted ? "inverse" : "solid"),
            ],
            { tone: plan.highlighted ? "brand" : "page" },
          ),
        ),
        { align: "stretch", animation: animate("stagger-up", { stagger: 120 }) },
      ),
    ]),
  ]);
}

/** A thin row of facts, such as "12 years · 400 clients". */
export function facts(items: Array<{ value: string; label: string }>): NodeBlueprint {
  return section(
    "Facts",
    [
      container([
        grid(
          Math.min(items.length, 4),
          items.map((item) => ({
            type: "box",
            name: "Fact",
            styles: {
              base: { display: "flex", flexDirection: "column", gap: "var(--lintel-space-1)" },
            },
            children: [
              {
                type: "text",
                name: "Number",
                props: { text: item.value },
                styles: {
                  base: {
                    fontSize: "2.5rem",
                    fontWeight: "700",
                    lineHeight: "1",
                    color: colour("brand"),
                  },
                },
              },
              text(item.label),
            ],
          })),
          { animation: animate("stagger-up", { stagger: 90 }) },
        ),
      ]),
    ],
    { padding: 7 },
  );
}
