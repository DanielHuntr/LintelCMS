import type { NodeBlueprint } from "../components/component-definition.js";
import {
  animate,
  button,
  card,
  container,
  grid,
  heading,
  lead,
  section,
  split,
  stack,
  text,
} from "./section-parts.js";

/** Sections for people who want to come by or book a time: opening times and booking. */

/** When you're open, day by day, beside where to find you. */
export function openingTimes(copy: {
  heading: string;
  text: string;
  days: Array<{ day: string; hours: string }>;
  address: string;
  directions: string;
}): NodeBlueprint {
  return section("Opening times", [
    container([
      split(
        stack(
          "Times",
          [
            heading(copy.heading, 2),
            lead(copy.text),
            ...copy.days.map((entry) =>
              stack("Day", [heading(entry.day, 3), text(entry.hours)], 1),
            ),
          ],
          3,
          { animation: animate("fade-up") },
        ),
        card(
          "Where to find us",
          [heading("Where to find us", 3), text(copy.address), text(copy.directions)],
          {
            tone: "panel",
          },
        ),
      ),
    ]),
  ]);
}

/** A few short steps to booking a time, with a button to book. */
export function booking(copy: {
  heading: string;
  text: string;
  steps: Array<{ heading: string; text: string }>;
  button: { label: string; href: string };
}): NodeBlueprint {
  return section(
    "Booking",
    [
      container(
        [
          heading(copy.heading, 2),
          lead(copy.text),
          grid(
            Math.min(copy.steps.length, 3),
            copy.steps.map((step) =>
              card("Booking step", [heading(step.heading, 3), text(step.text)], { tone: "page" }),
            ),
            { gap: 4, animation: animate("stagger-up", { stagger: 100 }) },
          ),
          button(copy.button.label, copy.button.href),
        ],
        { centred: true },
      ),
    ],
    { tone: "panel" },
  );
}
