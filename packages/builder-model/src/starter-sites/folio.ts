import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import { siteLogo, siteMenuRow } from "../sections/site-navigation.js";
import type { StarterSite } from "./starter-site.js";

/**
 * Folio: a personal site for a photographer and art director. Off-white paper and
 * near-black ink in light mode, the other way round in dark, one grotesque (Archivo) with a
 * monospace (Space Mono) for the small details, and a strict twelve-column grid that the
 * big pieces step across. The navigation and footer are the site's own (site-sections/),
 * shown on every page.
 */

// Colours follow the visitor's light or dark setting (CSS light-dark), so they are only set here.
const paper = "light-dark(#f2f0eb, #121211)";
const ink = "light-dark(#161615, #ecebe6)";
const quiet = "light-dark(#5e5c57, #a3a09a)";
const rule = "light-dark(#d4d0c8, #2e2d2a)";
const mono = "'Space Mono', ui-monospace, monospace";

const name = "Ilse Moreau";
const email = "ilse@example.com";

/** Small capitals in the monospace, for labels, years and the clock. */
const detail: StyleDeclarations = {
  fontFamily: mono,
  fontSize: "0.75rem",
  lineHeight: "1.5",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const plainLink: StyleDeclarations = {
  color: ink,
  textDecoration: "none",
};

/** A band of the page on the site's paper, with the same side margins everywhere. */
function band(
  bandName: string,
  children: NodeBlueprint[],
  options: { element?: string; top?: number; bottom?: number; styles?: NodeStyles } = {},
): NodeBlueprint {
  const top = options.top ?? 8;
  const bottom = options.bottom ?? 8;
  return {
    type: "section",
    name: bandName,
    props: { element: options.element ?? "section", anchor: "" },
    styles: {
      ...options.styles,
      base: {
        backgroundColor: paper,
        color: ink,
        paddingTop: space(top),
        paddingBottom: space(bottom),
        paddingLeft: "clamp(1.25rem, 3vw, 2.5rem)",
        paddingRight: "clamp(1.25rem, 3vw, 2.5rem)",
        ...options.styles?.base,
      },
      phone: {
        paddingTop: space(Math.max(top - 2, 4)),
        paddingBottom: space(Math.max(bottom - 2, 4)),
        ...options.styles?.phone,
      },
    },
    children,
  };
}

/** A band laid out on the twelve-column grid; on phones it goes back to one under another. */
function gridBand(
  bandName: string,
  children: NodeBlueprint[],
  options: { top?: number; bottom?: number } = {},
): NodeBlueprint {
  return {
    ...band(bandName, children, {
      ...options,
      styles: { base: { columnGap: "clamp(0.75rem, 1.6vw, 1.5rem)", rowGap: space(5) } },
    }),
    placedGrid: { columns: 12, stackOnPhone: true },
  };
}

/** Where an element sits on the grid: columns `column` to `column + span - 1` of row `row`. */
function at(column: number, span: number, row: number, extra: StyleDeclarations = {}): NodeStyles {
  return {
    base: { gridColumn: `${column} / span ${span}`, gridRow: String(row), ...extra },
  };
}

/** A blueprint with more styles, screen size by screen size, over the ones it has. */
function withStyles(blueprint: NodeBlueprint, styles: NodeStyles): NodeBlueprint {
  const own = blueprint.styles ?? { base: {} };
  return {
    ...blueprint,
    styles: {
      ...own,
      ...styles,
      base: { ...own.base, ...styles.base },
      ...(own.phone || styles.phone ? { phone: { ...own.phone, ...styles.phone } } : {}),
    },
  };
}

function label(words: string, labelName = "Label"): NodeBlueprint {
  return {
    type: "text",
    name: labelName,
    props: { text: words },
    styles: { base: { ...detail, color: quiet } },
  };
}

function link(words: string, href: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "link",
    props: { label: words, href, openInNewTab: false },
    styles: { base: { ...plainLink, ...styles }, hover: { opacity: "0.6" } },
  };
}

/** The site's navigation, on every page: the name, the time where she is and the menu. */
function header(): NodeBlueprint {
  return band(
    "Header",
    [
      // The site's name, linking home, so it follows Site settings and the site's address.
      siteLogo("name", {
        ...plainLink,
        fontFamily: "inherit",
        fontWeight: "700",
        fontSize: "1rem",
        letterSpacing: "-0.01em",
        minHeight: "0",
      }),
      {
        type: "clock",
        name: "Local time",
        props: { zone: "Europe/Lisbon", hours: "24", label: "Lisbon" },
        styles: { base: { ...detail }, phone: { order: "3", width: "100%" } },
      },
      // The site's main menu (Content → Menus), which the template fills with its pages.
      siteMenuRow({ always: true, styles: { fontWeight: "400", color: ink } }),
    ],
    {
      element: "header",
      top: 4,
      bottom: 4,
      styles: {
        base: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: space(4),
        },
        phone: { paddingTop: space(4), paddingBottom: space(4) },
      },
    },
  );
}

/** The site's footer, on every page: how to write, where to follow, and the small print. */
function footer(): NodeBlueprint {
  return band(
    "Footer",
    [
      link(email, `mailto:${email}`, { fontSize: "1rem" }),
      {
        type: "box",
        name: "Social links",
        styles: {
          base: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: space(5) },
        },
        children: [
          link("Instagram", "https://www.instagram.com/", detail),
          link("Are.na", "https://www.are.na/", detail),
          link("Vimeo", "https://vimeo.com/", detail),
        ],
      },
      label(`© 2026 ${name}`, "Small print"),
    ],
    {
      element: "footer",
      top: 6,
      bottom: 6,
      styles: {
        base: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: space(5),
          borderStyle: "solid",
          borderColor: rule,
          borderWidth: "1px 0 0 0",
        },
        phone: { flexDirection: "column", alignItems: "flex-start" },
      },
    },
  );
}

const picture = (illustration: string) => `/_lintel/illustrations/${illustration}.svg`;

interface Work {
  title: string;
  client: string;
  year: string;
  illustration: string;
  alt: string;
}

const works: readonly Work[] = [
  {
    title: "Salt House",
    client: "Hotel interiors for Casa Sal",
    year: "2026",
    illustration: "folio-window",
    alt: "Afternoon light from a window falling across a plain wall",
  },
  {
    title: "Slow Clay",
    client: "Catalogue for Oficina Barro",
    year: "2025",
    illustration: "folio-vessel",
    alt: "A dark clay vessel on a pale plinth",
  },
  {
    title: "Tide Tables",
    client: "Self-published book",
    year: "2025",
    illustration: "folio-horizon",
    alt: "A flat sea under a low sun",
  },
  {
    title: "Sitting Still",
    client: "Campaign for Hartwell Joinery",
    year: "2024",
    illustration: "folio-chair",
    alt: "A wooden chair and its long shadow against a white wall",
  },
  {
    title: "Concrete Weather",
    client: "Editorial for Plano magazine",
    year: "2024",
    illustration: "folio-tower",
    alt: "A concrete block of flats at dusk with a few lit windows",
  },
  {
    title: "Under the Arcades",
    client: "Exhibition at Galeria Norte",
    year: "2023",
    illustration: "folio-arch",
    alt: "Three arches in hard sunlight, their shadows on the floor",
  },
  {
    title: "Linen Season",
    client: "Lookbook for Fold & Field",
    year: "2022",
    illustration: "folio-fold",
    alt: "Pale linen cloth folded over the edge of a dark table",
  },
  {
    title: "Upward",
    client: "Personal series",
    year: "2021",
    illustration: "folio-stair",
    alt: "A spiral staircase seen from below, rings of light closing in on a skylight",
  },
];

function workPicture(work: Work): NodeBlueprint {
  return {
    type: "image",
    props: { src: picture(work.illustration), alt: work.alt, assetId: null, caption: "" },
    styles: { base: { width: "100%", height: "auto", aspectRatio: "4 / 5", borderRadius: "0" } },
  };
}

/** One frame of the drag gallery: the picture, then its title and year. */
function gallerySlide(work: Work): NodeBlueprint {
  return {
    type: "slide",
    props: { label: work.title },
    children: [
      workPicture(work),
      {
        type: "box",
        name: "Caption",
        styles: {
          base: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: space(3),
          },
        },
        children: [
          {
            type: "text",
            name: "Title",
            props: { text: work.title },
            styles: { base: { fontSize: "1rem" } },
          },
          {
            type: "text",
            name: "Year",
            props: { text: work.year },
            styles: { base: { ...detail, color: quiet } },
          },
        ],
      },
    ],
  };
}

/** One row of the project list: number, title, client and year, with its picture on hover. */
function projectRow(work: Work, index: number): NodeBlueprint {
  const number = String(index + 1).padStart(2, "0");
  return {
    type: "box",
    name: "Project",
    props: { element: "article" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "3rem minmax(0, 6fr) minmax(0, 4fr) 4rem",
        alignItems: "baseline",
        gap: space(4),
        paddingTop: space(5),
        paddingBottom: space(5),
        borderStyle: "solid",
        borderColor: rule,
        borderWidth: "1px 0 0 0",
      },
      hover: { opacity: "0.55" },
      phone: { gridTemplateColumns: "2rem minmax(0, 1fr) 3rem", rowGap: space(1) },
    },
    effects: [
      { effect: "hover-picture", params: { src: picture(work.illustration), size: "medium" } },
    ],
    children: [
      {
        type: "text",
        name: "Number",
        props: { text: number },
        styles: { base: { ...detail, color: quiet } },
      },
      {
        type: "heading",
        name: "Project title",
        props: { text: work.title, level: 2 },
        styles: {
          base: {
            fontSize: "clamp(1.5rem, 3.4vw, 3rem)",
            fontWeight: "400",
            lineHeight: "1.05",
            letterSpacing: "-0.03em",
            marginTop: "0",
            marginBottom: "0",
          },
        },
      },
      {
        type: "text",
        name: "Client",
        props: { text: work.client },
        styles: {
          base: { color: quiet, fontSize: "0.9375rem" },
          phone: { gridColumn: "2 / span 2", gridRow: "2" },
        },
      },
      {
        type: "text",
        name: "Year",
        props: { text: work.year },
        styles: {
          base: { ...detail, textAlign: "right" },
          phone: { gridColumn: "3", gridRow: "1" },
        },
      },
    ],
  };
}

/** The top of an inner page: a label, a large title and a sentence, stepped across the grid. */
function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      withStyles(label(copy.label), at(1, 3, 1)),
      {
        type: "heading",
        name: "Page title",
        props: { text: copy.title, level: 1 },
        styles: {
          ...at(1, 10, 2, {
            fontSize: "clamp(3rem, 10vw, 9.5rem)",
            fontWeight: "400",
            lineHeight: "0.92",
            letterSpacing: "-0.045em",
            marginTop: "0",
            marginBottom: "0",
          }),
        },
        animation: animate("words-rise"),
      },
      withStyles(
        {
          type: "text",
          name: "Introduction",
          props: { text: copy.text },
          animation: animate("fade-in", { delay: 300 }),
        },
        at(7, 5, 3, { fontSize: "1.125rem", lineHeight: "1.5", maxWidth: "34rem" }),
      ),
    ],
    { top: 8, bottom: 7 },
  );
}

export const folioSite: StarterSite = {
  id: "folio",
  name: "Folio",
  description:
    "A spare personal site for one person’s work: a gallery visitors drag through, a list of projects and a way to get in touch.",
  suitedTo: "Photographers, art directors and other freelancers",
  coverIllustration: "folio-cover",
  theme: {
    brandColour: "#161615",
    accentColour: "#c4462b",
    fontPairing: "system",
    cornerStyle: "square",
    headingFont: "Archivo",
    bodyFont: "Archivo",
  },
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "dot", colour: "text", size: 12 },
    pageTransition: { style: "fade", duration: 400 },
    intro: { style: "counter", text: name, background: "#121211", colour: "#f2f0eb" },
  },
  siteSections: { navigation: header(), footer: footer() },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: `${name}: photographs of rooms, objects and the people who make them.`,
      sections: [
        gridBand(
          "Introduction",
          [
            withStyles(label("Photographer and art director"), at(1, 4, 1)),
            withStyles(label("Taking on work from March"), {
              ...at(9, 4, 1, { textAlign: "right" }),
              phone: { textAlign: "left" },
            }),
            {
              type: "heading",
              name: "Main title",
              props: {
                text: "I photograph rooms, objects and the hands that make them.",
                level: 1,
              },
              styles: {
                ...at(1, 11, 2, {
                  fontSize: "clamp(2.5rem, 7.4vw, 7.25rem)",
                  fontWeight: "400",
                  lineHeight: "0.95",
                  letterSpacing: "-0.04em",
                  marginTop: space(6),
                  marginBottom: "0",
                }),
                phone: { marginTop: space(4) },
              },
              animation: animate("words-rise"),
            },
            withStyles(
              {
                type: "text",
                name: "About in a line",
                props: {
                  text: "Twelve years of interiors, still life and quiet portraits for architects, makers and the magazines that write about them.",
                },
                animation: animate("fade-in", { delay: 400 }),
              },
              at(7, 5, 3, { fontSize: "1.125rem", lineHeight: "1.5", maxWidth: "30rem" }),
            ),
          ],
          { top: 8, bottom: 7 },
        ),
        band(
          "Selected work",
          [
            {
              type: "box",
              name: "Gallery title",
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  borderStyle: "solid",
                  borderColor: rule,
                  borderWidth: "1px 0 0 0",
                  paddingTop: space(4),
                },
              },
              children: [
                {
                  type: "heading",
                  name: "Section title",
                  props: { text: "Selected work", level: 2 },
                  styles: {
                    base: { ...detail, fontWeight: "400", marginTop: "0", marginBottom: "0" },
                  },
                },
                label("2021 – 2026", "Years"),
              ],
            },
            {
              type: "carousel",
              name: "Drag gallery",
              props: {
                label: "Selected work",
                perView: 4,
                autoplay: false,
                autoplaySeconds: 6,
                loop: false,
                showDots: false,
                freeDrag: true,
              },
              effects: [{ effect: "cursor-word", params: { text: "Drag" } }],
              animation: animate("fade-up", { delay: 150 }),
              children: works.slice(0, 6).map(gallerySlide),
            },
          ],
          {
            top: 4,
            bottom: 8,
            styles: { base: { display: "flex", flexDirection: "column", gap: space(5) } },
          },
        ),
        gridBand(
          "About in short",
          [
            withStyles(label("Now"), at(1, 2, 1)),
            withStyles(
              {
                type: "text",
                name: "Statement",
                props: {
                  text: "I work slowly and travel light: one camera, two lenses and a lot of looking before anything gets made. Most of my clients come back.",
                },
                animation: animate("fade-up"),
              },
              at(3, 8, 1, {
                fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
              }),
            ),
            withStyles(
              link("More about me", "/about", { ...detail, textDecoration: "underline" }),
              at(3, 3, 2),
            ),
            withStyles(
              link("Start a project", "/contact", { ...detail, textDecoration: "underline" }),
              at(6, 3, 2),
            ),
          ],
          { top: 6, bottom: 9 },
        ),
      ],
    },
    {
      slug: "projects",
      title: "Projects",
      summary: "Commissions and personal work, from 2021 to now.",
      sections: [
        pageTop({
          label: `Index, ${works.at(-1)?.year} – ${works[0]?.year}`,
          title: "Projects",
          text: "Commissions and personal work, newest first.",
        }),
        band(
          "Project list",
          [
            {
              type: "box",
              name: "Projects",
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "0",
                  borderStyle: "solid",
                  borderColor: rule,
                  borderWidth: "0 0 1px 0",
                },
              },
              animation: animate("stagger-up", { stagger: 60 }),
              children: works.map(projectRow),
            },
          ],
          { top: 2, bottom: 9 },
        ),
      ],
    },
    {
      slug: "about",
      title: "About",
      summary: `Who ${name} is, who she has worked with and what she has won.`,
      sections: [
        gridBand(
          "About",
          [
            withStyles(label("About"), at(1, 3, 1)),
            withStyles(
              {
                type: "image",
                name: "Portrait",
                props: {
                  src: picture("folio-portrait"),
                  alt: "Drawing of a woman with a dark bob holding a camera up to her face",
                  assetId: null,
                  caption: "",
                },
                animation: animate("mask-reveal-up"),
              },
              {
                base: {
                  gridColumn: "1 / span 5",
                  gridRow: "2 / span 3",
                  width: "100%",
                  height: "auto",
                  borderRadius: "0",
                },
              },
            ),
            {
              type: "heading",
              name: "Page title",
              props: { text: "Hello, I’m Ilse.", level: 1 },
              styles: at(7, 6, 2, {
                fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
                fontWeight: "400",
                lineHeight: "0.95",
                letterSpacing: "-0.04em",
                marginTop: "0",
                marginBottom: "0",
              }),
              animation: animate("words-rise"),
            },
            withStyles(
              {
                type: "text",
                name: "Biography",
                props: {
                  text: "I grew up above my father’s print shop in Porto and learned to look at paper before I learned to look through a lens. After studying architecture I spent six years assisting still-life photographers in London, then came home to Lisbon to work for myself.\n\nToday I photograph interiors, objects and the people who make them, and art-direct the shoots I’m not behind the camera for. I like natural light, long lunches and briefs that leave room for a surprise.",
                },
                animation: animate("fade-up", { delay: 200 }),
              },
              at(7, 5, 3, { fontSize: "1.0625rem", lineHeight: "1.6", whiteSpace: "pre-line" }),
            ),
          ],
          { top: 8, bottom: 8 },
        ),
        gridBand(
          "Clients and awards",
          [
            {
              type: "heading",
              name: "Clients title",
              props: { text: "Clients", level: 2 },
              styles: at(1, 2, 1, { ...detail, fontWeight: "400", color: quiet, marginTop: "0" }),
            },
            withStyles(
              {
                type: "text",
                name: "Clients",
                props: {
                  text: "Casa Sal\nOficina Barro\nHartwell Joinery\nPlano magazine\nGaleria Norte\nFold & Field\nStudio Arenal\nThe Long Table",
                },
                animation: animate("fade-up"),
              },
              at(3, 4, 1, { fontSize: "1.25rem", lineHeight: "1.45", whiteSpace: "pre-line" }),
            ),
            {
              type: "heading",
              name: "Awards title",
              props: { text: "Recognition", level: 2 },
              styles: at(7, 2, 1, { ...detail, fontWeight: "400", color: quiet, marginTop: "0" }),
            },
            withStyles(
              {
                type: "text",
                name: "Awards",
                props: {
                  text: "Interiors Photographer of the Year, shortlist, 2025\nPortuguese Design Awards, gold, 2024\nGaleria Norte, solo show, 2023\nNew Light grant, 2021",
                },
                animation: animate("fade-up", { delay: 150 }),
              },
              at(9, 4, 1, { fontSize: "1.25rem", lineHeight: "1.45", whiteSpace: "pre-line" }),
            ),
          ],
          { top: 6, bottom: 9 },
        ),
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      summary: "Commissions, prints and press: how to get in touch.",
      sections: [
        withStyles(
          gridBand(
            "Contact",
            [
              withStyles(label("Contact"), at(1, 3, 1)),
              {
                type: "heading",
                name: "Page title",
                props: { text: "Tell me what you’re making.", level: 1 },
                styles: at(1, 8, 2, {
                  fontSize: "clamp(1.75rem, 3.6vw, 3rem)",
                  fontWeight: "400",
                  lineHeight: "1.1",
                  letterSpacing: "-0.03em",
                  marginTop: space(4),
                  marginBottom: "0",
                }),
                animation: animate("fade-up"),
              },
              {
                ...link(email, `mailto:${email}`, {
                  fontSize: "clamp(2.25rem, 8.6vw, 9rem)",
                  lineHeight: "1",
                  letterSpacing: "-0.05em",
                  gridColumn: "1 / span 12",
                  gridRow: "3",
                }),
                name: "Email",
                effects: [{ effect: "cursor-word", params: { text: "Write" } }],
                animation: animate("mask-reveal-up", { delay: 150 }),
              },
              withStyles(
                {
                  type: "text",
                  name: "How to write",
                  props: {
                    text: "Say where and when, what it’s for and roughly what you’d like to spend. I answer every email within two working days.",
                  },
                },
                {
                  ...at(1, 4, 4, { color: quiet, marginTop: space(6) }),
                  phone: { marginTop: "0" },
                },
              ),
              withStyles(label("Elsewhere", "Social title"), {
                ...at(7, 2, 4, { marginTop: space(6) }),
                phone: { marginTop: space(4) },
              }),
              {
                type: "box",
                name: "Social links",
                styles: {
                  ...at(9, 4, 4, {
                    display: "flex",
                    flexDirection: "column",
                    gap: space(2),
                    marginTop: space(6),
                  }),
                  phone: { marginTop: "0" },
                },
                children: [
                  link("Instagram ↗", "https://www.instagram.com/", { fontSize: "1.25rem" }),
                  link("Are.na ↗", "https://www.are.na/", { fontSize: "1.25rem" }),
                  link("Vimeo ↗", "https://vimeo.com/", { fontSize: "1.25rem" }),
                  link("LinkedIn ↗", "https://www.linkedin.com/", { fontSize: "1.25rem" }),
                ],
              },
            ],
            { top: 8, bottom: 9 },
          ),
          // Tall enough that the footer sits at the bottom of the window: the last row takes the rest.
          {
            base: { minHeight: "calc(100svh - 6.5rem)", gridTemplateRows: "auto auto auto 1fr" },
            phone: {
              minHeight: "calc(100svh - 9.5rem)",
              gridTemplateRows: "none",
              gridAutoRows: "min-content",
            },
          },
        ),
      ],
    },
  ],
};
