import { fromTo } from "@lintel/motion/presets";
import type { MotionSpec } from "@lintel/motion/schema";
import type { NodeBlueprint } from "../components/component-definition.js";
import type {
  NodeAnimation,
  NodeStyles,
  StyleDeclarations,
} from "../document/page-document.schema.js";
import { gridPlaceStyles } from "../placed-grid/placed-grid.js";
import { animate, colour, space } from "../sections/section-parts.js";
import { menuDrawer, siteLogo, siteMenuRow } from "../sections/site-navigation.js";
import type { StarterPage, StarterSite } from "./starter-site.js";

/**
 * Atelier: an editorial site for Wrenfold, a small furniture workshop. Big serif type on a
 * twelve-column grid with deliberate offsets, line drawings on warm paper, and quick,
 * quiet motion: a headline that arrives letter by letter, a drawing that drifts as the page
 * scrolls, and a held scene that walks through how a chair is made.
 */

// ---------------------------------------------------------------------------------------
// The look: one walnut accent, warm paper bands mixed from it (so they follow light and
// dark), the heading font for display type and small capitals for labels and captions.
// ---------------------------------------------------------------------------------------

const paperBand =
  "color-mix(in srgb, var(--lintel-color-brand) 9%, var(--lintel-color-background))";
const quiet = colour("text-secondary");
const displayFont = "var(--lintel-font-heading)";
/** Boxes stack what is in them, with even gaps. */
const column: StyleDeclarations = { display: "flex", flexDirection: "column" };

/** A place on the grid: columns from `column`, rows from `row`. */
function place(column: number, columnSpan: number, row: number, rowSpan = 1): StyleDeclarations {
  return gridPlaceStyles({ column, columnSpan, row, rowSpan });
}

/** Where an element sits on phones, when it keeps a place of its own there. */
function phonePlace(column: number, columnSpan: number): StyleDeclarations {
  return { gridColumn: `${column} / span ${columnSpan}`, gridRow: "auto" };
}

/** A preset tuned for this site: same name in the Motion panel, different timing or tracks. */
function tuned(presetId: string, changes: Partial<MotionSpec>): NodeAnimation {
  const base = animate(presetId);
  return { presetId, spec: { ...base.spec, ...changes } };
}

/** The big headline arriving one letter after another, each rising a little as it fades in. */
const letterReveal = tuned("letters-drop", {
  stagger: { each: 32, from: "first" },
  duration: 900,
  easing: "easeOutQuint",
  tracks: [fromTo("opacity", 0, 1), fromTo("translateY", "0.35em", 0)],
});

/** The held scene: the page stops while the three steps slide past, then scrolls on. */
const stepsScene = tuned("horizontal-scroll", {
  trigger: {
    type: "scroll",
    scope: "element",
    start: { element: 0, viewport: 0 },
    end: { element: 1, viewport: 1 },
    pin: { length: 2 },
    smooth: 0.3,
    snap: [0, 0.5, 1],
  },
  targets: { type: "selector", selector: ":scope > * > :last-child" },
  tracks: [fromTo("translateX", "0%", "-66.6667%")],
});

const rise = (delay = 0) => animate("fade-up", { delay, duration: 800 });

function smallCaps(words: string, name: string, extras: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "text",
    name,
    props: { text: words },
    styles: {
      base: {
        fontSize: "0.75rem",
        fontWeight: "600",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        lineHeight: "1.5",
        color: quiet,
        ...extras,
      },
    },
  };
}

function display(
  text: string,
  level: number,
  name: string,
  size: string,
  styles: NodeStyles = { base: {} },
  animation?: NodeAnimation,
): NodeBlueprint {
  return {
    type: "heading",
    name,
    props: { text, level },
    styles: {
      ...styles,
      base: {
        fontFamily: displayFont,
        fontWeight: "400",
        fontSize: size,
        lineHeight: "0.95",
        letterSpacing: "-0.025em",
        textWrap: "balance",
        ...styles.base,
      },
    },
    ...(animation ? { animation } : {}),
  };
}

function words(text: string, name: string, styles: NodeStyles = { base: {} }): NodeBlueprint {
  return {
    type: "text",
    name,
    props: { text },
    styles: {
      ...styles,
      base: { fontSize: "1.0625rem", lineHeight: "1.65", maxWidth: "38rem", ...styles.base },
    },
  };
}

function drawing(
  name: string,
  picture: string,
  alt: string,
  styles: StyleDeclarations = {},
  phone?: StyleDeclarations,
): NodeBlueprint {
  return {
    type: "image",
    name,
    props: { src: `/_lintel/illustrations/${picture}.svg`, alt, assetId: null, caption: "" },
    styles: {
      base: { width: "100%", height: "auto", borderRadius: "0", ...styles },
      ...(phone ? { phone } : {}),
    },
  };
}

function textLink(label: string, href: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "link",
    props: { label, href, openInNewTab: false },
    styles: {
      base: {
        fontSize: "0.8125rem",
        fontWeight: "600",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "inherit",
        textDecoration: "underline",
        width: "fit-content",
        ...styles,
      },
      hover: { color: colour("link") },
    },
  };
}

/** A band on the twelve-column grid. Everything stacks on phones unless it says otherwise. */
function gridSection(
  name: string,
  children: NodeBlueprint[],
  options: {
    paper?: boolean;
    top?: number;
    bottom?: number;
    element?: string;
    extra?: StyleDeclarations;
  } = {},
): NodeBlueprint {
  const top = options.top ?? 8;
  const bottom = options.bottom ?? 8;
  return {
    type: "section",
    name,
    props: { element: options.element ?? "section", anchor: "" },
    placedGrid: { columns: 12, stackOnPhone: true },
    styles: {
      base: {
        paddingTop: space(top),
        paddingBottom: space(bottom),
        paddingLeft: "clamp(1.25rem, 4vw, 3.5rem)",
        paddingRight: "clamp(1.25rem, 4vw, 3.5rem)",
        columnGap: "clamp(0.75rem, 2vw, 1.75rem)",
        rowGap: space(5),
        ...(options.paper ? { backgroundColor: paperBand } : {}),
        ...options.extra,
      },
      phone: {
        paddingTop: space(Math.max(top - 2, 5)),
        paddingBottom: space(Math.max(bottom - 2, 5)),
      },
    },
    children,
  };
}

/** A full-width drawing that drifts slower than the page, inside a frame that is uncovered. */
function bleedPicture(name: string, picture: string, alt: string, height: string): NodeBlueprint {
  return {
    type: "section",
    name,
    props: { element: "section", anchor: "" },
    styles: { base: { paddingTop: "0", paddingBottom: "0", paddingLeft: "0", paddingRight: "0" } },
    children: [
      {
        type: "box",
        name: "Picture frame",
        styles: {
          base: { display: "block", height, overflow: "hidden", backgroundColor: paperBand },
          phone: { height: "clamp(16rem, 52vh, 26rem)" },
        },
        animation: animate("mask-reveal-up", { duration: 1100 }),
        children: [
          {
            ...drawing("Picture", picture, alt, {
              height: "124%",
              marginTop: "-12%",
              objectFit: "cover",
              objectPosition: "center",
            }),
            animation: tuned("parallax-slow", { tracks: [fromTo("translateY", "-7%", "7%")] }),
          },
        ],
      },
    ],
  };
}

interface Piece {
  number: string;
  name: string;
  details: string;
  picture: string;
  alt: string;
}

/** One piece of furniture: its drawing, then its number, name and what it is made of. */
function pieceCard(piece: Piece, styles: NodeStyles, linksTo?: string): NodeBlueprint {
  return {
    type: "card",
    name: piece.name,
    props: { href: linksTo ?? "", look: "plain" },
    styles: {
      ...styles,
      base: {
        display: "flex",
        flexDirection: "column",
        gap: space(3),
        paddingTop: "0",
        paddingBottom: "0",
        paddingLeft: "0",
        paddingRight: "0",
        backgroundColor: "transparent",
        borderWidth: "0",
        borderRadius: "0",
        boxShadow: "none",
        color: "inherit",
        textDecoration: "none",
        position: "relative",
        ...styles.base,
      },
    },
    ...(linksTo ? { effects: [{ effect: "cursor-word", params: { text: "View" } }] } : {}),
    children: [
      {
        ...drawing("Picture", piece.picture, piece.alt, {
          aspectRatio: "4 / 5",
          objectFit: "cover",
        }),
        animation: animate("mask-reveal-up", { duration: 1000 }),
      },
      {
        type: "box",
        name: "Caption",
        styles: { base: { display: "flex", flexDirection: "column", gap: space(1) } },
        children: [
          smallCaps(piece.number, "Number"),
          {
            type: "heading",
            name: "Piece name",
            props: { text: piece.name, level: 3 },
            styles: {
              base: {
                fontFamily: displayFont,
                fontWeight: "400",
                fontSize: "1.75rem",
                lineHeight: "1.1",
              },
            },
          },
          smallCaps(piece.details, "Made from", { letterSpacing: "0.12em" }),
        ],
      },
    ],
  };
}

const chair: Piece = {
  number: "No. 01",
  name: "Hollin chair",
  details: "Steam-bent ash, oiled oak seat",
  picture: "atelier-chair",
  alt: "Line drawing of a chair with a curved back, slender spindles and splayed legs",
};
const table: Piece = {
  number: "No. 04",
  name: "Mead table",
  details: "Quarter-sawn oak, seats eight",
  picture: "atelier-table",
  alt: "Line drawing of a long trestle table with a bowl on top",
};
const stool: Piece = {
  number: "No. 07",
  name: "Three-leg stool",
  details: "Ash, turned on a pole lathe",
  picture: "atelier-stool",
  alt: "Line drawing of a round stool on three splayed legs joined by a ring",
};
const cabinet: Piece = {
  number: "No. 09",
  name: "Larder cabinet",
  details: "Oak frame, slatted doors",
  picture: "atelier-cabinet",
  alt: "Line drawing of a tall cabinet with two slatted doors on short legs",
};
const bench: Piece = {
  number: "No. 11",
  name: "Hall bench",
  details: "Oak, wedged through-tenons",
  picture: "atelier-bench",
  alt: "Line drawing of a long, low bench with a folded blanket at one end",
};

/** The site's navigation, on every page: the workshop's name in the serif, the menu in small caps. */
function navigation(): NodeBlueprint {
  return {
    type: "section",
    name: "Navigation",
    props: { element: "header", anchor: "" },
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space(5),
        paddingTop: space(4),
        paddingBottom: space(4),
        paddingLeft: "clamp(1.25rem, 4vw, 3.5rem)",
        paddingRight: "clamp(1.25rem, 4vw, 3.5rem)",
      },
    },
    children: [
      siteLogo("name", {
        fontFamily: displayFont,
        fontWeight: "400",
        fontSize: "1.75rem",
        letterSpacing: "-0.02em",
      }),
      siteMenuRow({
        styles: {
          fontSize: "0.8125rem",
          fontWeight: "600",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        },
      }),
      menuDrawer(),
    ],
  };
}

/** The site's footer, on every page: the workshop's name, where it is and the pages. */
function footer(): NodeBlueprint {
  return gridSection(
    "Footer",
    [
      display("Wrenfold", 2, "Workshop name", "clamp(3rem, 9vw, 8rem)", {
        base: { ...place(1, 7, 1) },
      }),
      {
        type: "box",
        name: "Address",
        styles: {
          base: { ...column, ...place(9, 4, 1), alignSelf: "end", gap: space(2) },
          tablet: place(8, 5, 1),
        },
        children: [
          smallCaps("Workshop and showroom", "Label"),
          words("The Old Dairy, Welshmill Lane, Frome, Somerset", "Where", {
            base: { fontSize: "1rem", lineHeight: "1.5" },
          }),
          textLink("workshop@example.com", "mailto:workshop@example.com", {
            textTransform: "none",
            letterSpacing: "0",
            fontSize: "1rem",
            fontWeight: "400",
          }),
        ],
      },
      {
        type: "box",
        name: "Footer links",
        props: { element: "nav" },
        styles: {
          base: {
            ...place(1, 12, 2),
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space(5),
            paddingTop: space(5),
            marginTop: space(6),
            borderWidth: "1px 0 0 0",
            borderStyle: "solid",
            borderColor: colour("border"),
          },
        },
        children: [
          textLink("Collection", "/collection"),
          textLink("Craft", "/craft"),
          textLink("Visit", "/visit"),
          // Shows only once the site asks visitors about cookies.
          { ...textLink("", ""), type: "cookieSettings", props: {} },
        ],
      },
    ],
    { paper: true, top: 8, bottom: 6, element: "footer" },
  );
}

// ---------------------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------------------

function step(
  number: string,
  title: string,
  text: string,
  picture: string,
  alt: string,
): NodeBlueprint {
  return {
    type: "box",
    name: `Step ${number}`,
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)",
        alignItems: "center",
        gap: "clamp(1.5rem, 5vw, 5rem)",
        width: "33.3333%",
        flexShrink: "0",
        paddingLeft: "clamp(1.25rem, 4vw, 3.5rem)",
        paddingRight: "clamp(1.25rem, 4vw, 3.5rem)",
        paddingBottom: space(6),
      },
      phone: {
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: space(4),
        paddingBottom: space(5),
      },
    },
    children: [
      {
        type: "box",
        name: "Words",
        styles: { base: { ...column, gap: space(4) } },
        children: [
          display(number, 3, "Step number", "clamp(4.5rem, 12vw, 10rem)", {
            base: { color: colour("brand"), lineHeight: "0.8" },
            phone: { fontSize: "4rem" },
          }),
          display(title, 3, "Step title", "clamp(2rem, 4vw, 3.5rem)"),
          words(text, "Step text", { base: { maxWidth: "28rem" } }),
        ],
      },
      drawing("Step picture", picture, alt, {
        maxHeight: "62vh",
        width: "auto",
        maxWidth: "100%",
        justifySelf: "center",
        aspectRatio: "1 / 1",
      }),
    ],
  };
}

const homePage: StarterPage = {
  slug: "home",
  title: "Home",
  summary:
    "Wrenfold makes chairs, tables and cabinets by hand in English oak and ash, in a workshop in Frome.",
  sections: [
    gridSection(
      "Opening",
      [
        smallCaps("Furniture makers in Frome, Somerset", "Label", { ...place(1, 6, 1) }),
        {
          type: "clock",
          name: "Workshop clock",
          props: { zone: "Europe/London", hours: "24", label: "Workshop" },
          styles: {
            base: {
              ...place(10, 3, 1),
              justifySelf: "end",
              fontSize: "0.75rem",
              fontWeight: "600",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: quiet,
            },
            phone: { display: "none" },
          },
        },
        display(
          "Made slowly, kept for good",
          1,
          "Headline",
          "clamp(3.5rem, 12.5vw, 13rem)",
          {
            base: { ...place(1, 12, 2), lineHeight: "0.88", marginTop: space(5) },
            phone: { fontSize: "clamp(3.25rem, 16vw, 4.5rem)", marginTop: space(3) },
          },
          letterReveal,
        ),
        {
          ...words(
            "Wrenfold is a workshop of four making chairs, tables and cabinets in English oak and ash. Every piece is made to order, by hand, and built so that it can be mended.",
            "Introduction",
            { base: { ...place(8, 4, 3), fontSize: "1.1875rem" }, tablet: place(6, 7, 3) },
          ),
          animation: rise(500),
        },
        textLink("See the collection", "/collection", { ...place(1, 4, 3), alignSelf: "end" }),
      ],
      { top: 7, bottom: 7 },
    ),
    bleedPicture(
      "Workshop picture",
      "atelier-workshop",
      "Line drawing of the workshop: a tall arched window, a workbench with chisels on the wall above it and a chair standing in the light",
      "clamp(20rem, 82vh, 54rem)",
    ),
    gridSection("Statement", [
      smallCaps("The workshop", "Label", { ...place(1, 2, 1), paddingTop: space(3) }),
      {
        type: "text",
        name: "Statement",
        props: {
          text: "Each piece starts as a tree we can name and ends as something you can hand on. In between are about a hundred hours, most of them spent on parts you will never see.",
        },
        styles: {
          base: {
            ...place(3, 9, 1),
            fontFamily: displayFont,
            fontSize: "clamp(1.75rem, 3.6vw, 3.25rem)",
            lineHeight: "1.15",
            letterSpacing: "-0.01em",
            textWrap: "pretty",
          },
          tablet: place(1, 12, 2),
        },
        animation: animate("words-rise", { stagger: 35, duration: 800 }),
      },
    ]),
    gridSection(
      "Collection",
      [
        display(
          "The collection",
          2,
          "Collection title",
          "clamp(3.25rem, 9vw, 9rem)",
          {
            base: { ...place(1, 8, 1), zIndex: "2", position: "relative", alignSelf: "end" },
          },
          animation("mask-reveal-right"),
        ),
        {
          ...words(
            "Twelve designs, each one drawn, built and lived with for a year before we offered it to anyone else.",
            "Collection note",
            { base: { ...place(10, 3, 1), alignSelf: "end" }, tablet: place(9, 4, 1) },
          ),
          animation: rise(),
        },
        pieceCard(
          chair,
          {
            base: { ...place(2, 4, 2, 3), marginTop: "clamp(-5rem, -4.5vw, -2rem)" },
            phone: { ...phonePlace(1, 9), marginTop: "0" },
          },
          "/collection",
        ),
        pieceCard(
          table,
          { base: { ...place(8, 4, 3, 3), marginTop: space(9) }, phone: phonePlace(4, 9) },
          "/collection",
        ),
        pieceCard(
          stool,
          { base: { ...place(1, 3, 6, 2), marginTop: space(6) }, phone: phonePlace(1, 8) },
          "/collection",
        ),
        pieceCard(
          cabinet,
          { base: { ...place(5, 4, 6, 3), marginTop: space(9) }, phone: phonePlace(5, 8) },
          "/collection",
        ),
        pieceCard(
          bench,
          { base: { ...place(10, 3, 7, 2), marginTop: space(8) }, phone: phonePlace(1, 10) },
          "/collection",
        ),
        textLink("All twelve pieces", "/collection", { ...place(10, 3, 9), alignSelf: "start" }),
      ],
      { top: 8, bottom: 9 },
    ),
    {
      type: "section",
      name: "How it is made",
      props: { element: "section", anchor: "how-it-is-made" },
      styles: {
        base: {
          paddingTop: "0",
          paddingBottom: "0",
          paddingLeft: "0",
          paddingRight: "0",
          backgroundColor: paperBand,
        },
      },
      animation: stepsScene,
      children: [
        {
          type: "box",
          name: "Scene",
          styles: {
            base: {
              display: "flex",
              flexDirection: "column",
              gap: space(5),
              paddingTop: "calc(var(--lintel-space-8) + 3rem)",
              overflow: "auto",
            },
            phone: { paddingTop: "calc(var(--lintel-space-5) + 7rem)", gap: space(3) },
          },
          children: [
            {
              type: "box",
              name: "Scene title",
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: space(3),
                  paddingLeft: "clamp(1.25rem, 4vw, 3.5rem)",
                  paddingRight: "clamp(1.25rem, 4vw, 3.5rem)",
                },
              },
              children: [
                display("How a Hollin chair is made", 2, "Title", "clamp(1.75rem, 3vw, 2.75rem)"),
                smallCaps("Three steps, about six weeks", "Label"),
              ],
            },
            {
              type: "box",
              name: "Steps",
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "row",
                  gap: "0",
                  width: "300%",
                  flexGrow: "1",
                },
              },
              children: [
                step(
                  "1",
                  "Choose the tree",
                  "We buy whole logs from woods within forty miles and have them sawn into boards. They dry in the yard for a year for every inch of thickness.",
                  "atelier-timber",
                  "Boards stacked to dry with sticks between them, beside the end of a log showing its rings",
                ),
                step(
                  "2",
                  "Cut the joints",
                  "Legs, rails and spindles meet in mortise and tenon joints, cut by hand and fixed with oak pegs instead of screws.",
                  "atelier-joint",
                  "A mortise cut into a chair leg, and the tenon on a rail that slots into it",
                ),
                step(
                  "3",
                  "Finish by hand",
                  "The last shavings come off with a hand plane, then three coats of hard wax oil, rubbed in a day apart. It darkens a little every year.",
                  "atelier-finish",
                  "A hand plane on a board, with a curl of shaving coming off the blade",
                ),
              ],
            },
          ],
        },
      ],
    },
    gridSection("Visit invitation", [
      display(
        "Come and sit in them",
        2,
        "Invitation",
        "clamp(3rem, 8vw, 8rem)",
        { base: place(1, 7, 1, 2), tablet: place(1, 12, 1) },
        animation("words-rise"),
      ),
      {
        type: "box",
        name: "Visit details",
        styles: {
          base: { ...column, ...place(9, 4, 2), gap: space(5), alignSelf: "end" },
          tablet: place(1, 8, 2),
        },
        animation: rise(),
        children: [
          words(
            "The showroom at the workshop is open Thursday to Saturday. Every chair there is for sitting in and every drawer for opening.",
            "Visit text",
          ),
          {
            type: "button",
            name: "Visit button",
            props: { label: "Plan a visit", href: "/visit", openInNewTab: false },
            styles: {
              base: {
                display: "inline-block",
                width: "fit-content",
                paddingTop: space(3),
                paddingBottom: space(3),
                paddingLeft: space(6),
                paddingRight: space(6),
                borderRadius: "999px",
                backgroundColor: colour("text"),
                color: colour("background"),
                fontWeight: "600",
                textDecoration: "none",
              },
              hover: { backgroundColor: colour("brand"), color: colour("on-brand") },
            },
            effects: [{ effect: "magnetic-pull", params: {} }],
          },
        ],
      },
    ]),
  ],
};

function animation(presetId: string): NodeAnimation {
  return animate(presetId);
}

// ---------------------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------------------

function pageOpening(
  label: string,
  title: string,
  introduction: string,
  extra: NodeBlueprint[] = [],
): NodeBlueprint {
  return gridSection(
    "Opening",
    [
      smallCaps(label, "Label", place(1, 6, 1)),
      ...extra,
      display(
        title,
        1,
        "Page title",
        "clamp(3.25rem, 10vw, 10rem)",
        { base: { ...place(1, 11, 2), marginTop: space(4) } },
        letterReveal,
      ),
      {
        ...words(introduction, "Introduction", {
          base: { ...place(7, 5, 3), fontSize: "1.1875rem" },
          tablet: place(4, 9, 3),
        }),
        animation: rise(400),
      },
    ],
    { top: 7, bottom: 7 },
  );
}

function slide(picture: string, alt: string, caption: string): NodeBlueprint {
  return {
    type: "slide",
    props: { label: caption },
    styles: { base: { display: "flex", flexDirection: "column", gap: space(3) } },
    children: [
      drawing("Picture", picture, alt, { aspectRatio: "1 / 1", objectFit: "cover" }),
      smallCaps(caption, "Caption"),
    ],
  };
}

function indexRow(piece: Piece, wood: string, weeks: string): NodeBlueprint {
  const cell = (text: string, name: string, styles: StyleDeclarations = {}) =>
    smallCaps(text, name, { letterSpacing: "0.12em", ...styles });
  return {
    type: "box",
    name: piece.name,
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "6rem minmax(0, 1fr) minmax(0, 1fr) 8rem",
        alignItems: "baseline",
        gap: space(4),
        paddingTop: space(4),
        paddingBottom: space(4),
        borderWidth: "1px 0 0 0",
        borderStyle: "solid",
        borderColor: colour("border"),
      },
      hover: { color: colour("brand") },
      phone: { gridTemplateColumns: "3.5rem minmax(0, 1fr) auto", gap: space(3) },
    },
    effects: [
      {
        effect: "hover-picture",
        params: { src: `/_lintel/illustrations/${piece.picture}.svg`, size: "medium" },
      },
    ],
    children: [
      cell(piece.number, "Number"),
      {
        type: "text",
        name: "Piece name",
        props: { text: piece.name },
        styles: {
          base: {
            fontFamily: displayFont,
            fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
            lineHeight: "1.1",
          },
        },
      },
      {
        ...cell(wood, "Wood"),
        styles: { base: cell(wood, "Wood").styles?.base ?? {}, phone: { display: "none" } },
      },
      cell(weeks, "Making time", { textAlign: "right" }),
    ],
  };
}

const armchair: Piece = {
  ...chair,
  number: "No. 02",
  name: "Hollin armchair",
  details: "Ash and oak, from £1,980",
  alt: "Line drawing of the Hollin chair, here with arms",
};

const collectionPage: StarterPage = {
  slug: "collection",
  title: "Collection",
  summary: "Twelve pieces of furniture in oak and ash, each made to order in Frome.",
  sections: [
    pageOpening(
      "Twelve designs, made to order",
      "The collection",
      "Each piece is made for the person who orders it, so allow ten to fourteen weeks. Prices include delivery in mainland Britain and a visit after the first year to check the joints.",
    ),
    gridSection(
      "Pieces",
      [
        pieceCard(
          { ...chair, details: "Ash and oak, from £1,450" },
          { base: place(1, 5, 1, 2), phone: phonePlace(1, 10) },
        ),
        pieceCard(
          { ...table, details: "Oak, from £6,200" },
          { base: { ...place(7, 6, 1, 2), marginTop: space(9) }, phone: phonePlace(3, 10) },
        ),
        pieceCard(
          { ...stool, details: "Ash, from £540" },
          { base: { ...place(2, 3, 3), marginTop: space(4) }, phone: phonePlace(1, 7) },
        ),
        pieceCard(armchair, {
          base: { ...place(5, 4, 3, 2), marginTop: space(7) },
          phone: phonePlace(4, 9),
        }),
        pieceCard(
          { ...cabinet, details: "Oak, from £4,800" },
          {
            base: {
              ...place(10, 3, 3, 2),
              marginTop: "-9rem",
              zIndex: "2",
              boxShadow: "0 0 0 14px var(--lintel-color-background)",
            },
            phone: { ...phonePlace(1, 9), marginTop: "0" },
          },
        ),
        pieceCard(
          { ...bench, details: "Oak, from £1,900" },
          { base: { ...place(9, 4, 5), marginTop: space(4) }, phone: phonePlace(2, 11) },
        ),
      ],
      { top: 4, bottom: 9 },
    ),
    gridSection(
      "Up close",
      [
        display("Up close", 2, "Title", "clamp(2.5rem, 6vw, 5.5rem)", { base: place(1, 6, 1) }),
        smallCaps("Drag to look along the bench", "Hint", {
          ...place(9, 4, 1),
          justifySelf: "end",
          alignSelf: "end",
        }),
        {
          type: "carousel",
          name: "Details",
          props: {
            label: "Details from the workshop",
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
            slide(
              "atelier-timber",
              "Oak boards stacked with sticks between them to dry",
              "Air-dried oak, a year per inch",
            ),
            slide(
              "atelier-joint",
              "A mortise and the tenon that fits it",
              "A pegged mortise and tenon",
            ),
            slide(
              "atelier-finish",
              "A hand plane taking a shaving off a board",
              "The last shaving",
            ),
            slide("atelier-tools", "Five chisels hanging from a rail", "Chisels, sharpened daily"),
            slide("atelier-stool", "The three-leg stool", "Pole-lathe turning"),
          ],
        },
      ],
      { paper: true, top: 8, bottom: 8 },
    ),
    gridSection("Index", [
      display("Index", 2, "Title", "clamp(2.5rem, 6vw, 5.5rem)", { base: place(1, 6, 1) }),
      {
        type: "box",
        name: "Index of pieces",
        styles: { base: { ...column, ...place(1, 12, 2), gap: "0" } },
        animation: animate("stagger-up"),
        children: [
          indexRow(chair, "Ash and oak", "10 weeks"),
          indexRow(armchair, "Ash and oak", "12 weeks"),
          indexRow(table, "Oak", "14 weeks"),
          indexRow(stool, "Ash", "6 weeks"),
          indexRow(cabinet, "Oak", "14 weeks"),
          indexRow(bench, "Oak", "8 weeks"),
        ],
      },
    ]),
  ],
};

// ---------------------------------------------------------------------------------------
// Craft
// ---------------------------------------------------------------------------------------

function chapter(label: string, paragraphs: string[], row: number): NodeBlueprint[] {
  return [
    smallCaps(label, `${label} label`, { ...place(2, 2, row), paddingTop: space(2) }),
    {
      type: "box",
      name: label,
      styles: {
        base: { ...column, ...place(4, 6, row), gap: space(5) },
        tablet: place(3, 9, row),
      },
      children: paragraphs.map((paragraph, index) =>
        words(paragraph, `Paragraph ${index + 1}`, {
          base: { fontSize: "1.1875rem", maxWidth: "36rem" },
        }),
      ),
    },
  ];
}

function pullQuote(text: string, styles: NodeStyles): NodeBlueprint {
  return {
    type: "quote",
    name: "Pull quote",
    props: { text, citation: "" },
    styles: {
      ...styles,
      base: {
        fontFamily: displayFont,
        fontStyle: "italic",
        fontSize: "clamp(2.25rem, 5.5vw, 5rem)",
        lineHeight: "1.05",
        letterSpacing: "-0.02em",
        textWrap: "balance",
        paddingTop: space(7),
        paddingBottom: space(7),
        paddingLeft: "0",
        borderWidth: "0",
        color: colour("brand"),
        ...styles.base,
      },
    },
    animation: animate("mask-reveal-right", { duration: 1100 }),
  };
}

const craftPage: StarterPage = {
  slug: "craft",
  title: "Craft",
  summary: "How a Wrenfold piece is made: the wood, the joints and the finish.",
  sections: [
    pageOpening(
      "On craft",
      "A hundred hours you will never see",
      "A Wrenfold chair takes about a hundred hours to make. Most of them go into things nobody notices until the chair is forty years old and still sound.",
    ),
    bleedPicture(
      "Grain picture",
      "atelier-grain",
      "Line drawing of oak grain flowing around a knot",
      "clamp(16rem, 60vh, 40rem)",
    ),
    gridSection(
      "Story",
      [
        ...chapter(
          "The wood",
          [
            "We start with the tree. Our oak and ash come from woods in Somerset and Wiltshire, felled in winter when the sap is down, and we know where every log grew. A board from the north side of a trunk moves differently from one from the south, and after fifteen years we can usually tell them apart by the smell.",
            "The boards dry slowly in an open shed behind the workshop, a year for every inch, then spend a month indoors before we cut them. Rushing this is how furniture ends up with gaps in its joints and drawers that stick in August.",
          ],
          1,
        ),
        pullQuote("Nothing is glued that might one day need taking apart.", {
          base: place(2, 10, 2),
          tablet: place(1, 12, 2),
        }),
        ...chapter(
          "The joints",
          [
            "Every joint is cut by hand. A mortise is chopped with a chisel the same width as the tenon that goes into it, and the fit is tried dry a dozen times before the pegs go in. We offset the peg holes by a hair, so the peg pulls the joint tight as it is driven.",
            "It is slower than screws and glue. It also means that in fifty years, when a leg works loose, someone with a mallet and a spare afternoon can knock it apart and put it back together.",
          ],
          3,
        ),
        {
          ...drawing(
            "Tools picture",
            "atelier-tools",
            "Five chisels of different widths hanging from a rail",
            { ...place(10, 3, 3), alignSelf: "start", marginTop: space(8) },
            { marginTop: "0", width: "70%" },
          ),
          animation: tuned("parallax-fast", { tracks: [fromTo("translateY", 60, -60)] }),
        },
        pullQuote("The finish should be the last thing you notice and the first thing you touch.", {
          base: { ...place(3, 10, 4), textAlign: "right" },
          tablet: place(1, 12, 4),
          phone: { textAlign: "left" },
        }),
        ...chapter(
          "The finish",
          [
            "We finish with oil and wax, never lacquer. Oil sinks into the wood instead of sitting on top of it, so a scratch can be rubbed out with a cloth rather than sanded back. Every piece leaves with a small tin and a card that explains how.",
            "Then it goes home with you, and the most important part of the work begins.",
          ],
          5,
        ),
      ],
      { top: 9, bottom: 9 },
    ),
  ],
};

// ---------------------------------------------------------------------------------------
// Visit
// ---------------------------------------------------------------------------------------

function detail(label: string, lines: string[], styles: NodeStyles): NodeBlueprint {
  return {
    type: "box",
    name: label,
    styles: { ...styles, base: { ...column, gap: space(2), ...styles.base } },
    children: [
      smallCaps(label, "Label"),
      ...lines.map((line, index) =>
        words(line, `Line ${index + 1}`, { base: { fontSize: "1.125rem", lineHeight: "1.5" } }),
      ),
    ],
  };
}

const visitPage: StarterPage = {
  slug: "visit",
  title: "Visit",
  summary: "The showroom and workshop in Frome: where it is, when it is open and how to get there.",
  sections: [
    pageOpening(
      "Showroom and workshop",
      "Visit us in Frome",
      "The showroom is in the front of the old dairy and the workshop is behind it. Come and sit in the chairs, open the drawers and, if we are not in the middle of gluing up, see what is on the bench.",
    ),
    bleedPicture(
      "Showroom picture",
      "atelier-showroom",
      "Line drawing of the showroom: a stone building with a tall arched door between two arched windows",
      "clamp(18rem, 70vh, 46rem)",
    ),
    gridSection(
      "Details",
      [
        {
          type: "box",
          name: "Visit details",
          styles: {
            base: { ...column, ...place(1, 6, 1), gap: space(7) },
            tablet: place(1, 12, 1),
          },
          animation: animate("stagger-up"),
          children: [
            detail("Address", ["The Old Dairy, Welshmill Lane", "Frome, Somerset"], { base: {} }),
            {
              type: "box",
              name: "Opening hours",
              styles: { base: { ...column, gap: space(2) } },
              children: [
                smallCaps("Opening hours", "Label"),
                words("Thursday and Friday, 10 till 5", "Line 1", {
                  base: { fontSize: "1.125rem", lineHeight: "1.5" },
                }),
                words("Saturday, 10 till 4", "Line 2", {
                  base: { fontSize: "1.125rem", lineHeight: "1.5" },
                }),
                words("Other days by appointment", "Line 3", {
                  base: { fontSize: "1.125rem", lineHeight: "1.5", color: quiet },
                }),
                {
                  type: "clock",
                  name: "Time in Frome",
                  props: { zone: "Europe/London", hours: "24", label: "In Frome it is" },
                  styles: {
                    base: {
                      marginTop: space(2),
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: quiet,
                    },
                  },
                },
              ],
            },
            detail(
              "Getting here",
              [
                "Ten minutes’ walk from Frome station. There is room for four cars in the yard, and a step-free door at the side.",
              ],
              { base: {} },
            ),
          ],
        },
        {
          ...drawing(
            "Map",
            "atelier-map",
            "Map of the streets around the showroom, with the river, the railway line and a dot where the showroom is",
            { ...place(8, 5, 1), alignSelf: "start", aspectRatio: "1 / 1" },
          ),
          animation: animate("mask-reveal-up", { duration: 1000 }),
        },
      ],
      { top: 9, bottom: 9 },
    ),
    gridSection(
      "Booking",
      [
        display(
          "Coming from further away?",
          2,
          "Title",
          "clamp(2.5rem, 6vw, 6rem)",
          { base: place(1, 8, 1), tablet: place(1, 12, 1) },
          animation("words-rise"),
        ),
        {
          type: "box",
          name: "Booking details",
          styles: { base: { ...column, ...place(9, 4, 2), gap: space(5) }, tablet: place(1, 8, 2) },
          animation: rise(),
          children: [
            words(
              "Tell us when you are coming and we will make sure the piece you want to see is on the floor, and the kettle is on.",
              "Booking text",
            ),
            textLink("Book a time", "mailto:workshop@example.com"),
          ],
        },
      ],
      { paper: true },
    ),
  ],
};

export const atelierSite: StarterSite = {
  id: "atelier",
  name: "Atelier",
  description:
    "An editorial site for a maker: big serif type, a magazine grid of the collection, a long-form story and a showroom page.",
  suitedTo: "Furniture makers, ceramicists, watchmakers and other workshops",
  coverIllustration: "atelier-cover",
  theme: {
    brandColour: "#86602f",
    accentColour: "#2e2620",
    fontPairing: "classic",
    cornerStyle: "square",
    headingFont: "Instrument Serif",
    bodyFont: "Work Sans",
  },
  siteMotion: {
    smoothScroll: { strength: "strong" },
    pageTransition: { style: "slide", duration: 650 },
    intro: { style: "name", text: "Wrenfold", background: "#2e2620", colour: "#ece3d4" },
    cursor: { style: "ring-and-dot", colour: "text", size: 36 },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, collectionPage, craftPage, visitPage],
};
