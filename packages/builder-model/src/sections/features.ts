import type { NodeBlueprint } from "../components/component-definition.js";
import {
  animate,
  badge,
  card,
  container,
  eyebrow,
  grid,
  heading,
  illustration,
  lead,
  link,
  list,
  section,
  split,
  stack,
  text,
} from "./section-parts.js";

/** Sections that explain: features, steps, a story beside a picture, and a gallery. */

export interface SectionIntro {
  label?: string;
  heading: string;
  text?: string;
}

export interface Point {
  heading: string;
  text: string;
}

function intro(copy: SectionIntro, centred = false): NodeBlueprint {
  return stack(
    "Introduction",
    [
      ...(copy.label ? [eyebrow(copy.label)] : []),
      heading(copy.heading, 2),
      ...(copy.text ? [lead(copy.text)] : []),
    ],
    3,
    {
      styles: {
        base: {
          display: "flex",
          flexDirection: "column",
          gap: "var(--lintel-space-3)",
          maxWidth: "44rem",
          ...(centred
            ? { alignItems: "center", textAlign: "center", marginLeft: "auto", marginRight: "auto" }
            : {}),
        },
      },
    },
  );
}

/** Three (or more) cards side by side that rise in one after another. */
export function featureCards(
  copy: SectionIntro & { points: Point[]; tone?: "page" | "panel" },
): NodeBlueprint {
  return section(
    "Features",
    [
      container([
        intro(copy),
        grid(
          Math.min(copy.points.length, 3),
          copy.points.map((point) =>
            card("Feature", [heading(point.heading, 3), text(point.text)], {
              tone: copy.tone === "panel" ? "page" : "panel",
            }),
          ),
          { animation: animate("stagger-up") },
        ),
      ]),
    ],
    { tone: copy.tone ?? "page" },
  );
}

/** Numbered steps: how working with you goes. */
export function steps(copy: SectionIntro & { points: Point[] }): NodeBlueprint {
  return section("Steps", [
    container([
      intro(copy, true),
      grid(
        Math.min(copy.points.length, 4),
        copy.points.map((point, index) =>
          stack("Step", [badge(String(index + 1)), heading(point.heading, 3), text(point.text)], 3),
        ),
        { animation: animate("stagger-up", { stagger: 120 }) },
      ),
    ]),
  ]);
}

/** A heading and a few lines beside a picture. */
export function story(copy: {
  heading: string;
  text: string;
  more?: { label: string; href: string };
  points?: string[];
  picture: { name: string; alt: string };
  pictureFirst?: boolean;
  tone?: "page" | "panel";
}): NodeBlueprint {
  const words = stack(
    "Story text",
    [
      heading(copy.heading, 2),
      text(copy.text),
      ...(copy.points ? [list(copy.points)] : []),
      ...(copy.more ? [link(copy.more.label, copy.more.href)] : []),
    ],
    4,
    { animation: animate(copy.pictureFirst ? "slide-in-right" : "slide-in-left") },
  );
  const picture = illustration(copy.picture.name, copy.picture.alt, {
    animation: animate("fade-in", { delay: 150, duration: 900 }),
  });
  return section(
    "Story",
    [container([copy.pictureFirst ? split(picture, words) : split(words, picture)])],
    { tone: copy.tone ?? "page" },
  );
}

/** A grid of pictures with short captions, such as past work. */
export function gallery(
  copy: SectionIntro & {
    items: Array<{ picture: string; alt: string; title: string; text: string }>;
  },
): NodeBlueprint {
  return section("Gallery", [
    container([
      intro(copy),
      grid(
        Math.min(copy.items.length, 3),
        copy.items.map((item) =>
          stack(
            "Gallery item",
            [illustration(item.picture, item.alt), heading(item.title, 3), text(item.text)],
            3,
            { animation: animate("hover-lift") },
          ),
        ),
        { gap: 6, animation: animate("stagger-up", { stagger: 100 }) },
      ),
    ]),
  ]);
}
