import type { NodeBlueprint } from "../components/component-definition.js";
import {
  animate,
  button,
  buttonRow,
  container,
  displayHeading,
  eyebrow,
  illustration,
  lead,
  section,
  split,
  stack,
} from "./section-parts.js";

/** The big welcome at the top of a page, in three shapes. */

export interface HeroCopy {
  label?: string;
  heading: string;
  text: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

function buttons(copy: HeroCopy, centred: boolean, inverse = false): NodeBlueprint {
  return buttonRow(
    [
      button(copy.primary.label, copy.primary.href, inverse ? "inverse" : "solid"),
      ...(copy.secondary ? [button(copy.secondary.label, copy.secondary.href, "outline")] : []),
    ],
    centred,
  );
}

/** Centred title, a line about you and buttons. */
export function centredHero(copy: HeroCopy): NodeBlueprint {
  return section(
    "Hero",
    [
      container(
        [
          ...(copy.label ? [eyebrow(copy.label)] : []),
          displayHeading(copy.heading, { animation: animate("words-rise") }),
          lead(copy.text, { animation: animate("fade-up", { delay: 250 }) }),
          { ...buttons(copy, true), animation: animate("fade-up", { delay: 400 }) },
        ],
        { width: "48rem", centred: true },
      ),
    ],
    { padding: 9 },
  );
}

/** Words on one side, a picture on the other. */
export function splitHero(
  copy: HeroCopy & { picture: { name: string; alt: string } },
): NodeBlueprint {
  return section(
    "Hero",
    [
      container([
        split(
          stack(
            "Hero text",
            [
              ...(copy.label ? [eyebrow(copy.label)] : []),
              displayHeading(copy.heading),
              lead(copy.text),
              buttons(copy, false),
            ],
            5,
            { animation: animate("slide-in-left") },
          ),
          illustration(copy.picture.name, copy.picture.alt, {
            animation: animate("scale-in", { delay: 150 }),
          }),
          "1.1fr 1fr",
        ),
      ]),
    ],
    { padding: 8 },
  );
}

/** A bold band in the brand colour. */
export function bannerHero(copy: HeroCopy): NodeBlueprint {
  return section(
    "Hero",
    [
      container(
        [
          displayHeading(copy.heading, { animation: animate("mask-reveal-up") }),
          lead(copy.text, { animation: animate("fade-in", { delay: 300 }) }),
          buttons(copy, true, true),
        ],
        { width: "52rem", centred: true },
      ),
    ],
    { tone: "brand", padding: 9 },
  );
}

/** The top of an inner page: a small label, the page's title and a sentence. */
export function pageHeader(copy: { label?: string; heading: string; text: string }): NodeBlueprint {
  return section(
    "Page header",
    [
      container(
        [
          ...(copy.label ? [eyebrow(copy.label)] : []),
          {
            type: "heading",
            name: "Page title",
            props: { text: copy.heading, level: 1 },
            styles: { base: { fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: "1.1" } },
            animation: animate("fade-up"),
          },
          lead(copy.text, { animation: animate("fade-in", { delay: 200 }) }),
        ],
        { width: "48rem", gap: 3 },
      ),
    ],
    { padding: 8, tone: "panel" },
  );
}
