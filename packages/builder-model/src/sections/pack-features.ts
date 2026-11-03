import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import {
  animate,
  colour,
  container,
  eyebrow,
  heading,
  illustration,
  lead,
  link,
  radius,
  section,
  space,
  stack,
  text,
} from "./section-parts.js";

/**
 * More sections for what you offer, who you are and your pictures: rows that alternate
 * sides, a feature list beside a picture, a comparison, numbered points, a team, a founder's
 * note, a wall of pictures and a gallery visitors drag. Theme tokens only; everything stacks
 * on phones.
 */

export interface PackPicture {
  name: string;
  alt: string;
}

const tight: StyleDeclarations = { marginTop: "0", marginBottom: "0" };
const quiet: StyleDeclarations = { color: colour("text-secondary") };

function sectionTitle(label: string | undefined, title: string, intro?: string): NodeBlueprint[] {
  return [
    ...(label ? [eyebrow(label)] : []),
    heading(title, 2, { styles: { base: { ...tight, maxWidth: "40rem" } } }),
    ...(intro ? [lead(intro, { styles: { base: { ...quiet, maxWidth: "40rem" } } })] : []),
  ];
}

/** A picture filling its frame at a fixed shape. */
function framed(picture: PackPicture, ratio: string, name = "Picture"): NodeBlueprint {
  return illustration(picture.name, picture.alt, {
    name,
    styles: {
      base: {
        width: "100%",
        height: "auto",
        aspectRatio: ratio,
        objectFit: "cover",
        borderRadius: radius("large"),
      },
    },
  });
}

/** Rows of a picture and a few words, the picture swapping sides each row. */
export function alternatingRows(copy: {
  heading: string;
  rows: Array<{ heading: string; text: string; picture: PackPicture }>;
}): NodeBlueprint {
  return section("Alternating rows", [
    container(
      [
        ...sectionTitle(undefined, copy.heading),
        ...copy.rows.map((row, index): NodeBlueprint => {
          const words = stack(
            "Words",
            [heading(row.heading, 3, { styles: { base: tight } }), text(row.text)],
            3,
            { styles: { base: { display: "flex", flexDirection: "column", gap: space(3) } } },
          );
          const picture = framed(row.picture, "4 / 3");
          const pictureFirst = index % 2 === 1;
          return {
            type: "columns",
            name: "Row",
            styles: {
              base: {
                display: "grid",
                gridTemplateColumns: pictureFirst
                  ? "minmax(0, 6fr) minmax(0, 5fr)"
                  : "minmax(0, 5fr) minmax(0, 6fr)",
                gap: space(7),
                alignItems: "center",
              },
              phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(4) },
            },
            animation: animate("fade-up"),
            // Words come first in reading order on phones whichever side the picture is on.
            children: pictureFirst
              ? [picture, { ...words, styles: { base: {}, phone: { order: "-1" } } }]
              : [words, picture],
          };
        }),
      ],
      { gap: 8 },
    ),
  ]);
}

/** A tall picture on one side, a list of points with ticks on the other. */
export function featureListWithPicture(copy: {
  label: string;
  heading: string;
  picture: PackPicture;
  features: Array<{ title: string; text: string }>;
}): NodeBlueprint {
  return section("Feature list with picture", [
    container([
      {
        type: "columns",
        name: "Two halves",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)",
            gap: space(8),
            alignItems: "center",
          },
          phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
        },
        children: [
          {
            ...framed(copy.picture, "4 / 5"),
            animation: animate("mask-reveal-up"),
          },
          stack(
            "Words",
            [
              ...sectionTitle(copy.label, copy.heading),
              {
                type: "featureList",
                name: "Points",
                props: {
                  features: copy.features.map((feature) => ({ icon: "check", ...feature })),
                  layout: "list",
                  columns: 1,
                },
                animation: animate("stagger-up"),
              },
            ],
            5,
          ),
        ],
      },
    ]),
  ]);
}

/** A table that sets you beside the usual way of doing things, row by row. */
export function comparisonTable(copy: {
  heading: string;
  text: string;
  columns: string[];
  rows: string[][];
}): NodeBlueprint {
  return section("Comparison", [
    container(
      [
        ...sectionTitle(undefined, copy.heading, copy.text),
        {
          type: "table",
          name: "Comparison table",
          props: {
            caption: "",
            headings: copy.columns,
            rows: copy.rows.map((cells) => ({ cells })),
            firstColumnIsHeading: true,
            striped: true,
          },
          styles: { base: { width: "100%", overflow: "auto" } },
          animation: animate("fade-up"),
        },
      ],
      { width: "56rem" },
    ),
  ]);
}

/** Points with big two-digit numbers, two by two, divided by hairlines. */
export function numberedPoints(copy: {
  heading: string;
  points: Array<{ heading: string; text: string }>;
}): NodeBlueprint {
  return section("Numbered points", [
    container([
      ...sectionTitle(undefined, copy.heading),
      {
        type: "columns",
        name: "Points",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            columnGap: space(7),
            rowGap: space(6),
          },
          phone: { gridTemplateColumns: "minmax(0, 1fr)", rowGap: space(5) },
        },
        animation: animate("stagger-up"),
        children: copy.points.map((point, index) => ({
          type: "box",
          name: "Point",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: "4rem minmax(0, 1fr)",
              gap: space(3),
              paddingTop: space(4),
              borderStyle: "solid",
              borderWidth: "1px 0 0 0",
              borderColor: colour("border"),
            },
            phone: { gridTemplateColumns: "3rem minmax(0, 1fr)" },
          },
          children: [
            text(String(index + 1).padStart(2, "0"), {
              name: "Number",
              styles: {
                base: {
                  fontFamily: "var(--lintel-font-heading)",
                  fontSize: "2rem",
                  lineHeight: "1",
                  color: colour("brand"),
                },
              },
            }),
            stack(
              "Words",
              [heading(point.heading, 3, { styles: { base: tight } }), text(point.text)],
              2,
            ),
          ],
        })),
      },
    ]),
  ]);
}

/** People in a grid: a square picture, a name and what they do. */
export function teamGrid(copy: {
  label: string;
  heading: string;
  people: Array<{ name: string; role: string; picture: PackPicture }>;
}): NodeBlueprint {
  return section("Team", [
    container([
      ...sectionTitle(copy.label, copy.heading),
      {
        type: "columns",
        name: "People",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: space(5),
          },
          tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
          phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: space(4) },
        },
        animation: animate("stagger-up"),
        children: copy.people.map((person) =>
          stack(
            "Person",
            [
              framed(person.picture, "1 / 1", "Photo"),
              heading(person.name, 3, {
                styles: { base: { ...tight, fontSize: "1.125rem" } },
              }),
              text(person.role, { name: "Role", styles: { base: { ...quiet, ...tight } } }),
            ],
            2,
          ),
        ),
      },
    ]),
  ]);
}

/** A short letter from the person behind it all, beside their picture, signed. */
export function founderNote(copy: {
  label: string;
  heading: string;
  text: string;
  signature: string;
  picture: PackPicture;
}): NodeBlueprint {
  return section(
    "Founder’s note",
    [
      container(
        [
          {
            type: "columns",
            name: "Two halves",
            styles: {
              base: {
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
                gap: space(8),
                alignItems: "start",
              },
              phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
            },
            children: [
              { ...framed(copy.picture, "3 / 4", "Portrait"), animation: animate("fade-in") },
              stack(
                "Letter",
                [
                  ...sectionTitle(copy.label, copy.heading),
                  text(copy.text, {
                    name: "Note",
                    styles: {
                      base: { fontSize: "1.125rem", lineHeight: "1.65", whiteSpace: "pre-line" },
                    },
                    animation: animate("fade-up", { delay: 150 }),
                  }),
                  text(copy.signature, {
                    name: "Signature",
                    styles: {
                      base: {
                        fontFamily: "var(--lintel-font-heading)",
                        fontSize: "1.5rem",
                        fontStyle: "italic",
                      },
                    },
                  }),
                ],
                4,
              ),
            ],
          },
        ],
        { width: "64rem" },
      ),
    ],
    { tone: "panel" },
  );
}

/** Pictures of different shapes in three columns, like a pinboard. */
export function pictureWall(copy: { heading: string; pictures: PackPicture[] }): NodeBlueprint {
  const shapes = ["4 / 5", "1 / 1", "3 / 4", "1 / 1", "4 / 5", "3 / 2"];
  const columnsOf = [0, 1, 2].map((column) =>
    copy.pictures.filter((_, index) => index % 3 === column),
  );
  return section("Picture wall", [
    container([
      ...sectionTitle(undefined, copy.heading),
      {
        type: "columns",
        name: "Wall",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: space(4),
            alignItems: "start",
          },
          phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(4) },
        },
        children: columnsOf.map((pictures, column) =>
          stack(
            "Column",
            pictures.map((picture, index) => ({
              ...framed(picture, shapes[(column + index * 3) % shapes.length] ?? "1 / 1"),
              animation: animate("fade-up", { delay: column * 120 }),
            })),
            4,
            column === 1
              ? {
                  styles: {
                    base: {
                      display: "flex",
                      flexDirection: "column",
                      gap: space(4),
                      marginTop: space(7),
                    },
                    phone: { marginTop: "0" },
                  },
                }
              : {},
          ),
        ),
      },
    ]),
  ]);
}

/** A row of pictures visitors drag sideways, each with a caption, the cursor saying Drag. */
export function dragGallery(copy: {
  heading: string;
  more: { label: string; href: string };
  items: Array<{ title: string; text: string; picture: PackPicture }>;
}): NodeBlueprint {
  return section("Drag gallery", [
    container(
      [
        {
          type: "box",
          name: "Gallery title",
          styles: {
            base: {
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: space(3),
            },
          },
          children: [
            heading(copy.heading, 2, { styles: { base: tight } }),
            link(copy.more.label, copy.more.href),
          ],
        },
        {
          type: "carousel",
          name: "Drag gallery",
          props: {
            label: copy.heading,
            perView: 3,
            autoplay: false,
            autoplaySeconds: 6,
            loop: false,
            showDots: false,
            freeDrag: true,
          },
          effects: [{ effect: "cursor-word", params: { text: "Drag" } }],
          animation: animate("fade-up", { delay: 150 }),
          children: copy.items.map((item) => ({
            type: "slide",
            props: { label: item.title },
            children: [
              framed(item.picture, "4 / 5"),
              heading(item.title, 3, {
                styles: { base: { ...tight, fontSize: "1.0625rem", marginTop: space(3) } },
              }),
              text(item.text, { styles: { base: { ...quiet, ...tight } } }),
            ],
          })),
        },
      ],
      { width: "80rem" },
    ),
  ]);
}
