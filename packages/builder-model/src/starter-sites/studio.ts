import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, StyleDeclarations } from "../document/page-document.schema.js";
import { animate, colour, space } from "../sections/section-parts.js";
import type { DesignVariable } from "../site-design/design-variables.js";
import type { StarterSite } from "./starter-site.js";

/**
 * Studio: the site of a small architecture and design practice. Big type on a twelve-column
 * grid with deliberate offsets, a project index whose rows show a drawing under the pointer,
 * and almost no colour besides ink, paper and one cobalt blue (the theme's brand colour, and
 * the Cobalt design variable, which is lighter in dark mode so it reads on ink).
 *
 * Every band is a section placed on twelve columns (the editorial grid), so people move
 * things by dragging them across the columns; on phones everything stacks in reading order.
 */

const studioEmail = "hello@corranwade.example";
const workshopPicture = "studio-workshop";
const workshopAlt =
  "Line drawing of the studio: a former rope works with a saw-tooth roof and a blue door";

/** The small uppercase captions and the recognition list, in the included mono font. */
const mono: StyleDeclarations = {
  fontFamily: "'Space Mono', ui-monospace, monospace",
  fontSize: "0.75rem",
  lineHeight: "1.5",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

/**
 * The one accent: cobalt, 7.1:1 on white and 5.8:1 on the drawings' paper. In dark mode it
 * is lighter (#7d95ff, 7.6:1 on black), so the hovered row and the step numbers read on ink.
 */
export const cobaltVariable = {
  id: "cobalt",
  name: "Cobalt",
  kind: "colour",
  value: "#2447d6",
  darkValue: "#7d95ff",
} satisfies DesignVariable;
const cobaltColour = `var(--lintel-var-${cobaltVariable.id})`;

const quiet: StyleDeclarations = { color: colour("text-secondary") };

/** The giant type at the top of each page. */
const giant: StyleDeclarations = {
  fontWeight: "700",
  lineHeight: "0.86",
  letterSpacing: "-0.05em",
  marginTop: "0",
  marginBottom: "0",
};

/** A section title: big enough to lead, small beside the page titles. */
const sectionTitle: StyleDeclarations = {
  fontSize: "clamp(1.75rem, 3.4vw, 3rem)",
  letterSpacing: "-0.03em",
  lineHeight: "1",
  marginTop: "0",
  marginBottom: "0",
};

/** Where an element sits on the twelve columns: `place(2, 5, 1)` is columns 2 to 6, row 1. */
function place(column: number, span: number, row: number, rowSpan = 1): StyleDeclarations {
  const line = (start: number, length: number) =>
    length > 1 ? `${start} / span ${length}` : String(start);
  return { gridColumn: line(column, span), gridRow: line(row, rowSpan) };
}

/** A hairline across the top of an element. */
const ruleAbove: StyleDeclarations = {
  borderStyle: "solid",
  borderWidth: "1px 0 0 0",
  borderColor: colour("border"),
};

/** A band of the page laid out on twelve columns, edge to edge with a margin. */
function band(
  name: string,
  children: NodeBlueprint[],
  options: { padding?: string; element?: string; rule?: boolean } = {},
): NodeBlueprint {
  const padding = options.padding ?? space(8);
  return {
    type: "section",
    name,
    props: { element: options.element ?? "section", anchor: "" },
    placedGrid: { columns: 12, stackOnPhone: true },
    styles: {
      base: {
        paddingTop: padding,
        paddingBottom: padding,
        paddingLeft: "clamp(1.25rem, 3.5vw, 3rem)",
        paddingRight: "clamp(1.25rem, 3.5vw, 3rem)",
        columnGap: space(5),
        rowGap: space(5),
        ...(options.rule ? ruleAbove : {}),
      },
      phone: { paddingTop: space(7), paddingBottom: space(7), rowGap: space(4) },
    },
    children,
  };
}

/** The same element with an animation from the Motion presets. */
function moving(
  blueprint: NodeBlueprint,
  presetId: string,
  changes?: Parameters<typeof animate>[1],
): NodeBlueprint {
  return { ...blueprint, animation: animate(presetId, changes) };
}

/** The same element with more styles for a screen size or a state. */
function also(blueprint: NodeBlueprint, more: Omit<NodeStyles, "base">): NodeBlueprint {
  return { ...blueprint, styles: { base: {}, ...blueprint.styles, ...more } };
}

function label(name: string, words: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "text",
    name,
    props: { text: words },
    styles: { base: { ...mono, ...quiet, marginTop: "0", marginBottom: "0", ...styles } },
  };
}

function words(name: string, text: string, styles: NodeStyles): NodeBlueprint {
  return { type: "text", name, props: { text }, styles };
}

function title(name: string, text: string, level: number, styles: NodeStyles): NodeBlueprint {
  return { type: "heading", name, props: { text, level }, styles };
}

function drawing(name: string, picture: string, alt: string, styles: NodeStyles): NodeBlueprint {
  return {
    type: "image",
    name,
    props: { src: `/_lintel/illustrations/${picture}.svg`, alt, assetId: null, caption: "" },
    styles,
  };
}

function pageLink(name: string, text: string, href: string, styles: NodeStyles): NodeBlueprint {
  return { type: "link", name, props: { label: text, href, openInNewTab: false }, styles };
}

function clock(name: string, label: string, styles: StyleDeclarations): NodeBlueprint {
  return {
    type: "clock",
    name,
    props: { zone: "Europe/Amsterdam", hours: "24", label },
    styles: { base: styles },
  };
}

interface Project {
  number: string;
  name: string;
  place: string;
  discipline: string;
  year: string;
  picture: string;
  alt: string;
}

const projects: readonly Project[] = [
  {
    number: "01",
    name: "Huis aan de Dijk",
    place: "Zeeland",
    discipline: "House",
    year: "2025",
    picture: "studio-house",
    alt: "Elevation drawing of a long, low house under one sloping roof, with a low blue sun",
  },
  {
    number: "02",
    name: "Maasbad",
    place: "Rotterdam",
    discipline: "Public building",
    year: "2024",
    picture: "studio-baths",
    alt: "Plan of public baths: a long pool, a round plunge pool and a row of cabins",
  },
  {
    number: "03",
    name: "The Long Table",
    place: "Delfshaven",
    discipline: "Furniture",
    year: "2024",
    picture: "studio-table",
    alt: "Line drawing of a long table with a blue bowl on it",
  },
  {
    number: "04",
    name: "Kade Reading Room",
    place: "Groningen",
    discipline: "Interiors",
    year: "2023",
    picture: "studio-library",
    alt: "Section through a vaulted reading room with three arched windows and low shelves",
  },
  {
    number: "05",
    name: "Polder Pavilion",
    place: "Flevoland",
    discipline: "Exhibition",
    year: "2022",
    picture: "studio-pavilion",
    alt: "White line drawing of a flat-roofed pavilion on thin columns, on a dark ground",
  },
  {
    number: "06",
    name: "Granary Offices",
    place: "Zwolle",
    discipline: "Workplace",
    year: "2021",
    picture: "studio-granary",
    alt: "Elevation of a tall gabled granary with a grid of small windows, one of them blue",
  },
];

interface IndexOptions {
  /** Where every row links to; left out, the rows are not links. */
  href?: string;
  /** The word the cursor shows over a row, such as "View". */
  cursorWord?: string;
  /**
   * "full" adds a Place column, for the Work page, where the index follows the page title
   * and the project names are its section titles (level 2).
   */
  columns: "short" | "full";
}

const indexColumns = {
  short: "3.5rem minmax(0, 1fr) 12rem 4rem",
  full: "3.5rem minmax(0, 1fr) 9rem 11rem 4rem",
};

/** On tablets and phones the middle columns fold away: the number, name and year stay. */
const smallerIndexColumns: Omit<NodeStyles, "base"> = {
  tablet: { gridTemplateColumns: "3rem minmax(0, 1fr) 4rem" },
  phone: { gridTemplateColumns: "2.25rem minmax(0, 1fr) auto", columnGap: space(3) },
};

const foldsAway: Omit<NodeStyles, "base"> = { tablet: { display: "none" } };

/**
 * One project as a row of the index. The whole row is a link, the cursor shows its word, and
 * a drawing of the project follows the pointer over it. On phones, with no pointer to
 * follow, the drawing sits in the row instead.
 */
function projectRow(project: Project, options: IndexOptions): NodeBlueprint {
  const cell = (name: string, text: string) =>
    also(label(name, text, { color: "inherit" }), foldsAway);
  return {
    type: "card",
    name: project.name,
    props: { href: options.href ?? "", look: "plain" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: indexColumns[options.columns],
        alignItems: "baseline",
        columnGap: space(5),
        rowGap: space(3),
        paddingTop: space(5),
        paddingBottom: space(5),
        borderRadius: "0",
        ...ruleAbove,
      },
      ...smallerIndexColumns,
      ...(options.href ? { hover: { color: cobaltColour } } : {}),
    },
    effects: [
      ...(options.cursorWord
        ? [{ effect: "cursor-word", params: { text: options.cursorWord } }]
        : []),
      {
        effect: "hover-picture",
        params: { src: `/_lintel/illustrations/${project.picture}.svg`, size: "medium" },
      },
    ],
    children: [
      label("Number", project.number, { color: "inherit" }),
      title("Project name", project.name, options.columns === "full" ? 2 : 3, {
        base: {
          fontSize:
            options.columns === "full"
              ? "clamp(1.5rem, 3.2vw, 3rem)"
              : "clamp(1.75rem, 4.6vw, 4.5rem)",
          fontWeight: "700",
          lineHeight: "1",
          letterSpacing: "-0.035em",
          marginTop: "0",
          marginBottom: "0",
        },
      }),
      ...(options.columns === "full" ? [cell("Place", project.place)] : []),
      cell("Discipline", project.discipline),
      label("Year", project.year, { color: "inherit", textAlign: "right" }),
      drawing("Phone picture", project.picture, project.alt, {
        base: { display: "none" },
        phone: { display: "block", gridColumn: "2 / -1", width: "100%", height: "auto" },
      }),
    ],
  };
}

/** The index of projects, one row each, across the whole grid in the given row. */
function projectIndex(row: number, options: IndexOptions): NodeBlueprint {
  return moving(
    {
      type: "box",
      name: "Project list",
      styles: {
        base: {
          ...place(1, 12, row),
          display: "flex",
          flexDirection: "column",
          gap: "0",
          borderStyle: "solid",
          borderWidth: "0 0 1px 0",
          borderColor: colour("border"),
        },
      },
      children: projects.map((project) => projectRow(project, options)),
    },
    "stagger-up",
  );
}

/** The same closing band on every page: the studio, its pages, its address and the time. */
function studioFooter(): NodeBlueprint {
  return band(
    "Footer",
    [
      words("Studio name", "Corran Wade", {
        base: {
          ...place(1, 6, 1),
          fontFamily: "var(--lintel-font-heading)",
          fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
          fontWeight: "700",
          lineHeight: "0.9",
          letterSpacing: "-0.05em",
          marginTop: "0",
          marginBottom: "0",
        },
      }),
      {
        type: "box",
        name: "Footer links",
        styles: {
          base: { ...place(7, 3, 1), display: "flex", flexDirection: "column", gap: space(2) },
        },
        children: [
          ...[
            ["Work", "/work"],
            ["Studio", "/studio"],
            ["Contact", "/contact"],
          ].map(([text = "", href = ""]) =>
            pageLink(text, text, href, {
              base: { color: "inherit", textDecoration: "none", width: "fit-content" },
              hover: { color: cobaltColour },
            }),
          ),
        ],
      },
      words("Address", "Keileweg 48, first floor\n3029 BS Rotterdam, Netherlands", {
        base: {
          ...place(10, 3, 1),
          ...quiet,
          marginTop: "0",
          marginBottom: "0",
          whiteSpace: "pre-line",
        },
      }),
      label("Small print", "© 2026 Corran Wade", place(1, 6, 2)),
      clock("Time in Rotterdam", "Rotterdam", { ...mono, ...place(10, 3, 2) }),
    ],
    { element: "footer", rule: true, padding: space(7) },
  );
}

const homePage = {
  slug: "home",
  title: "Home",
  summary:
    "Corran Wade is an architecture and design studio in Rotterdam: houses, public rooms and the furniture in them.",
  sections: [
    band(
      "Opening",
      [
        label("What we do", "Architecture, interiors & objects", place(1, 5, 1)),
        clock("Time in Rotterdam", "Rotterdam", {
          ...mono,
          ...place(10, 3, 1),
          justifySelf: "end",
        }),
        moving(
          title("Studio name", "Corran Wade", 1, {
            base: {
              ...place(1, 7, 3),
              ...giant,
              fontSize: "clamp(4rem, 15.4vw, 19rem)",
              zIndex: "1",
            },
            phone: { fontSize: "23vw" },
          }),
          "letters-drop",
        ),
        moving(
          drawing("Opening picture", "studio-house", projects[0]?.alt ?? "", {
            base: { ...place(8, 5, 2, 3), width: "100%", height: "auto", alignSelf: "start" },
            // The first row of the index shows the same drawing just below on phones.
            phone: { display: "none" },
          }),
          "mask-reveal-up",
          { delay: 200 },
        ),
        moving(
          words(
            "Statement",
            "Buildings, rooms and objects that get better the longer you stay in them.",
            {
              base: {
                ...place(1, 6, 4),
                fontSize: "clamp(1.375rem, 2.4vw, 2.25rem)",
                lineHeight: "1.15",
                letterSpacing: "-0.015em",
                marginTop: "0",
                marginBottom: "0",
                maxWidth: "22ch",
              },
            },
          ),
          "fade-up",
          { delay: 450 },
        ),
      ],
      { padding: space(6) },
    ),
    band("Selected work", [
      title("Index title", "Selected work", 2, {
        base: { ...place(1, 6, 1), ...mono, marginTop: "0", marginBottom: "0" },
      }),
      label("Count", "(06)", { ...place(10, 3, 1), textAlign: "right" }),
      projectIndex(2, { href: "/work", cursorWord: "View", columns: "short" }),
    ]),
    band("About the studio", [
      label("Section label", "The studio", place(1, 3, 1)),
      moving(
        words(
          "Studio statement",
          "We are eleven people in a former rope works on the Maas. Every project starts on site, with a tape measure and a flask of coffee, and we stay until the last hinge is fitted.",
          {
            base: {
              ...place(4, 8, 1),
              fontSize: "clamp(1.5rem, 3vw, 2.75rem)",
              lineHeight: "1.18",
              letterSpacing: "-0.02em",
              marginTop: "0",
              marginBottom: "0",
            },
          },
        ),
        "words-rise",
      ),
      pageLink("Studio link", "Meet the studio", "/studio", {
        base: { ...place(4, 4, 2), fontWeight: "600" },
      }),
    ]),
    band("Recognition", [
      title("Recognition title", "Recognition", 2, {
        base: {
          ...place(1, 3, 1),
          fontSize: "1.25rem",
          letterSpacing: "-0.01em",
          marginTop: "0",
          marginBottom: "0",
        },
      }),
      moving(
        {
          type: "box",
          name: "Recognition list",
          props: { element: "ul" },
          styles: {
            base: {
              ...place(5, 8, 1),
              display: "flex",
              flexDirection: "column",
              gap: "0",
              marginTop: "0",
              marginBottom: "0",
              paddingLeft: "0",
            },
          },
          children: [
            ["2025", "North Sea House Prize, winner", "Huis aan de Dijk"],
            ["2024", "Northern Bathing Review, building of the year", "Maasbad"],
            ["2024", "Material Fair Rotterdam, best in show", "The Long Table"],
            ["2023", "Reading Rooms of Europe, shortlist", "Kade Reading Room"],
            ["2022", "Low Country Landscape Awards, exhibition design", "Polder Pavilion"],
          ].map(([year = "", award = "", project = ""]) => ({
            type: "box",
            name: "Recognition",
            props: { element: "li" },
            styles: {
              base: {
                display: "grid",
                gridTemplateColumns: "4rem minmax(0, 1fr) 14rem",
                gap: space(4),
                paddingTop: space(3),
                paddingBottom: space(3),
                ...ruleAbove,
              },
              phone: { gridTemplateColumns: "3rem minmax(0, 1fr)", rowGap: space(1) },
            },
            children: [
              label("Year", year, { color: "inherit" }),
              label("Award", award, { color: "inherit" }),
              also(label("Project", project), { phone: { gridColumn: "2" } }),
            ],
          })),
        },
        "stagger-up",
      ),
    ]),
    studioFooter(),
  ],
};

const workPage = {
  slug: "work",
  title: "Work",
  summary: "Houses, public buildings, interiors and furniture by Corran Wade, from 2014 to now.",
  sections: [
    band(
      "Opening",
      [
        label("Section label", "Index, 2014 to now", place(1, 4, 1)),
        moving(
          title("Page title", "Work", 1, {
            base: { ...place(1, 8, 2), ...giant, fontSize: "clamp(5rem, 21vw, 21rem)" },
            phone: { fontSize: "30vw" },
          }),
          "letters-drop",
        ),
        moving(
          words(
            "Introduction",
            "Thirty-one buildings, rooms and objects since 2014. These are the ones we would happily walk you round.",
            {
              base: {
                ...place(9, 4, 2),
                alignSelf: "end",
                fontSize: "1.125rem",
                lineHeight: "1.45",
                marginTop: "0",
                marginBottom: "0",
              },
            },
          ),
          "fade-up",
          { delay: 300 },
        ),
      ],
      { padding: space(6) },
    ),
    band("Index", [
      {
        type: "box",
        name: "Column names",
        styles: {
          base: {
            ...place(1, 12, 1),
            display: "grid",
            gridTemplateColumns: indexColumns.full,
            columnGap: space(5),
          },
          ...smallerIndexColumns,
          phone: { display: "none" },
        },
        children: [
          label("Number", "No."),
          label("Project", "Project"),
          also(label("Place", "Place"), foldsAway),
          also(label("Discipline", "Discipline"), foldsAway),
          label("Year", "Year", { textAlign: "right" }),
        ],
      },
      projectIndex(2, { columns: "full" }),
    ]),
    band("Drawings", [
      title("Drawings title", "From the drawing board", 2, {
        base: { ...place(1, 6, 1), ...sectionTitle },
      }),
      label("Hint", "Drag to look through", {
        ...place(10, 3, 1),
        textAlign: "right",
        alignSelf: "end",
      }),
      moving(
        {
          type: "carousel",
          name: "Drawing gallery",
          props: {
            label: "Drawings from the studio",
            perView: 3,
            autoplay: false,
            autoplaySeconds: 6,
            loop: false,
            showDots: false,
            freeDrag: true,
          },
          styles: { base: place(1, 12, 2) },
          effects: [{ effect: "cursor-word", params: { text: "Drag" } }],
          children: [
            [
              "studio-site-plan",
              "Site plan with contour lines, a building’s footprint and a dotted path to the door",
            ],
            ["studio-library", projects[3]?.alt ?? ""],
            ["studio-baths", projects[1]?.alt ?? ""],
            ["studio-table", projects[2]?.alt ?? ""],
            ["studio-granary", projects[5]?.alt ?? ""],
          ].map(([picture = "", alt = ""]) => ({
            type: "slide",
            props: { label: "" },
            children: [
              drawing("Drawing", picture, alt, { base: { width: "100%", height: "auto" } }),
            ],
          })),
        },
        "fade-up",
      ),
    ]),
    studioFooter(),
  ],
};

const studioPage = {
  slug: "studio",
  title: "Studio",
  summary: "Who we are, how we work and the people at Corran Wade.",
  sections: [
    band(
      "Opening",
      [
        label("Section label", "Studio", place(1, 3, 1)),
        moving(
          title("Page title", "Eleven people and one long table", 1, {
            base: {
              ...place(1, 10, 2),
              ...giant,
              fontSize: "clamp(3rem, 8.4vw, 8.5rem)",
              lineHeight: "0.9",
              letterSpacing: "-0.045em",
            },
          }),
          "words-rise",
        ),
        moving(
          words(
            "Introduction",
            "Mieke Corran and Tobias Wade started the studio in 2014, after ten years of drawing other people’s buildings. They still answer the phone themselves.",
            {
              base: {
                ...place(7, 5, 3),
                marginTop: space(4),
                fontSize: "1.25rem",
                lineHeight: "1.45",
                marginBottom: "0",
              },
            },
          ),
          "fade-up",
          { delay: 300 },
        ),
      ],
      { padding: space(6) },
    ),
    band("Workshop", [
      moving(
        drawing("Workshop picture", workshopPicture, workshopAlt, {
          base: { ...place(1, 7, 1, 2), width: "100%", height: "auto" },
        }),
        "parallax-slow",
      ),
      label("Caption", "Our workshop in the Merwe-Vierhavens, Rotterdam", place(1, 4, 3)),
      moving(
        words(
          "About",
          "The building made ships’ rope for sixty years. We kept the long ropewalk, the saw-tooth roof and the hoist, and added a model shop, a library of materials and a kitchen everyone stops in at one.",
          {
            base: {
              ...place(9, 4, 1),
              alignSelf: "end",
              fontSize: "1.0625rem",
              lineHeight: "1.55",
              marginTop: "0",
              marginBottom: "0",
            },
          },
        ),
        "fade-up",
      ),
    ]),
    band(
      "Approach",
      [
        title("Approach title", "How we work", 2, { base: { ...place(1, 4, 1), ...sectionTitle } }),
        ...[
          [
            "01",
            "Go there first",
            "Before any drawing we spend a day on the site, at different hours, with the people who will use it.",
          ],
          [
            "02",
            "Decide with models",
            "We build card and timber models at every stage. It is the quickest way to agree on a room.",
          ],
          [
            "03",
            "Fewer materials, made well",
            "Three or four materials, chosen early and detailed carefully, age better than ten.",
          ],
          [
            "04",
            "Stay for the first winter",
            "We visit every finished project after its first winter and fix what the weather finds.",
          ],
        ].map(([number = "", heading = "", text = ""], index) =>
          moving(
            {
              type: "box",
              name: `Step ${number}`,
              styles: {
                base: {
                  // Alternate steps step one column in, so the list reads as a stagger.
                  ...place(index % 2 === 0 ? 6 : 8, 5, index + 1),
                  display: "grid",
                  gridTemplateColumns: "3rem minmax(0, 1fr)",
                  columnGap: space(4),
                  rowGap: space(2),
                  paddingBottom: space(5),
                },
              },
              children: [
                label("Number", number, { color: cobaltColour }),
                title("Step title", heading, 3, {
                  base: {
                    fontSize: "1.5rem",
                    letterSpacing: "-0.02em",
                    lineHeight: "1.15",
                    marginTop: "0",
                    marginBottom: "0",
                  },
                }),
                words("Step text", text, {
                  base: { gridColumn: "2", marginTop: "0", marginBottom: "0", ...quiet },
                }),
              ],
            },
            "fade-up",
          ),
        ),
      ],
      { rule: true },
    ),
    band(
      "People",
      [
        title("People title", "People", 2, { base: { ...place(1, 4, 1), ...sectionTitle } }),
        moving(
          {
            type: "box",
            name: "People list",
            props: { element: "ul" },
            styles: {
              base: {
                ...place(5, 8, 1),
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                columnGap: space(5),
                marginTop: "0",
                marginBottom: "0",
                paddingLeft: "0",
              },
              phone: { gridTemplateColumns: "minmax(0, 1fr)" },
            },
            children: [
              ["Mieke Corran", "Partner, architect"],
              ["Tobias Wade", "Partner, architect"],
              ["Sanne Verhoef", "Associate, interiors"],
              ["Joris Bakker", "Architect"],
              ["Rosa Lindqvist", "Furniture and objects"],
              ["Daan Hoekstra", "Model maker"],
              ["Femke Ouwens", "Architect"],
              ["Hugo Fenn", "Studio manager"],
            ].map(([name = "", role = ""]) => ({
              type: "box",
              name,
              props: { element: "li" },
              styles: {
                base: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  gap: space(3),
                  paddingTop: space(3),
                  paddingBottom: space(3),
                  ...ruleAbove,
                },
              },
              children: [
                title("Name", name, 3, {
                  base: {
                    fontSize: "1.125rem",
                    fontWeight: "600",
                    marginTop: "0",
                    marginBottom: "0",
                  },
                }),
                label("Role", role),
              ],
            })),
          },
          "stagger-up",
        ),
      ],
      { rule: true },
    ),
    studioFooter(),
  ],
};

const contactPage = {
  slug: "contact",
  title: "Contact",
  summary: "Write to Corran Wade, call the studio or come and see the workshop in Rotterdam.",
  sections: [
    band(
      "Opening",
      [
        label("Section label", "Contact", place(1, 3, 1)),
        moving(
          title("Page title", "Tell us about the place", 1, {
            base: {
              ...place(1, 8, 2),
              fontSize: "clamp(2.25rem, 5vw, 5rem)",
              fontWeight: "700",
              lineHeight: "0.95",
              letterSpacing: "-0.04em",
              marginTop: "0",
              marginBottom: "0",
            },
          }),
          "words-rise",
        ),
        moving(
          pageLink("Email", studioEmail, `mailto:${studioEmail}`, {
            base: {
              ...place(1, 12, 3),
              fontFamily: "var(--lintel-font-heading)",
              fontSize: "clamp(1.5rem, 6.2vw, 7.5rem)",
              fontWeight: "700",
              lineHeight: "1",
              letterSpacing: "-0.05em",
              color: "inherit",
              textDecoration: "none",
              marginTop: space(6),
            },
            hover: { color: cobaltColour },
            phone: { fontSize: "5.9vw" },
          }),
          "mask-reveal-up",
          { delay: 250 },
        ),
      ],
      { padding: space(6) },
    ),
    band(
      "Details",
      [
        ...[
          {
            name: "Studio",
            text: "Keileweg 48, first floor\n3029 BS Rotterdam, Netherlands",
            column: 1,
          },
          { name: "Telephone", text: "+31 10 000 0000", column: 4 },
          {
            name: "Hours",
            text: "Monday to Friday, 9:00 to 18:00. Visits by appointment.",
            column: 10,
          },
        ].map((detail) => ({
          type: "box",
          name: detail.name,
          styles: {
            base: {
              ...place(detail.column, 3, 1),
              display: "flex",
              flexDirection: "column",
              gap: space(2),
            },
          },
          children: [
            label("Label", detail.name),
            words("Details", detail.text, {
              base: { marginTop: "0", marginBottom: "0", whiteSpace: "pre-line" },
            }),
          ],
        })),
        {
          type: "box",
          name: "Time",
          styles: {
            base: { ...place(7, 3, 1), display: "flex", flexDirection: "column", gap: space(2) },
          },
          children: [
            label("Label", "Local time"),
            // The clock shows the city's name above the time.
            clock("Clock", "", {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: space(1),
              fontFamily: "var(--lintel-font-heading)",
              fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
              fontWeight: "700",
              lineHeight: "1",
              letterSpacing: "-0.03em",
            }),
          ],
        },
      ].map((detail) => moving(detail, "fade-up")),
      { rule: true },
    ),
    band("Getting here", [
      title("Getting here title", "Getting here", 2, {
        base: { ...place(1, 4, 1), ...sectionTitle },
      }),
      words(
        "Directions",
        "Ten minutes’ walk from Marconiplein metro station. Go through the yellow gate, cross the yard and ring the bell by the blue door. We are on the first floor.",
        { base: { ...place(1, 4, 2), ...quiet, marginTop: "0", marginBottom: "0" } },
      ),
      moving(
        drawing("Workshop picture", workshopPicture, workshopAlt, {
          base: { ...place(6, 7, 1, 3), width: "100%", height: "auto" },
        }),
        "mask-reveal-up",
      ),
    ]),
    studioFooter(),
  ],
};

export const studioSite: StarterSite = {
  id: "studio",
  name: "Studio",
  description:
    "A quiet, typographic site for a design or architecture practice: an index of projects, the people and how to visit.",
  suitedTo: "Architects, interior designers and design studios",
  coverIllustration: "studio-cover",
  theme: {
    brandColour: "#2447d6",
    accentColour: "#1a1a1a",
    fontPairing: "system",
    cornerStyle: "square",
    headingFont: "Space Grotesk",
    bodyFont: "Inter",
  },
  designVariables: [cobaltVariable],
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "ring", colour: "text", size: 28 },
    pageTransition: { style: "fade" },
    intro: { style: "none" },
  },
  pages: [homePage, workPage, studioPage, contactPage],
};
