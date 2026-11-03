import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import { menuDrawer, siteLogo, siteMenuRow } from "../sections/site-navigation.js";
import type { StarterSite } from "./starter-site.js";

/**
 * Longplay: the site of a four-piece band from Manchester. Tall condensed capitals (Anton)
 * over a monospace (Space Mono), bone paper and near-black ink that swap in dark mode, and
 * one signal red. The home page opens on a dark stage whatever the visitor's setting, with
 * the band's name across the whole width. Pages: the latest record and a video, the
 * discography, tour dates with tickets, and the mailing list. The navigation and footer are
 * the site's own (site-sections/), shown on every page.
 */

// Colours follow the visitor's light or dark setting (CSS light-dark).
const paper = "light-dark(#ece6da, #0e0d0c)";
const ink = "light-dark(#141311, #ece6da)";
const quiet = "light-dark(#55504a, #a39c90)";
const rule = "light-dark(#cbc3b4, #2b2925)";
/** The one accent: 6.4:1 on bone, and the lighter red 6.2:1 on black. */
const signal = "light-dark(#b8321a, #ff5a36)";

/** The stage: always dark, in light mode too. */
const stage = { background: "#0e0d0c", text: "#ece6da", quiet: "#a39c90", signal: "#ff5a36" };

const display = "var(--lintel-font-heading)";
const bandName = "Halfway Lights";
const ticketsUrl = "https://tickets.example.com/halfway-lights";

/** Small capitals in the monospace, for dates, labels and links. */
const detail: StyleDeclarations = {
  fontSize: "0.75rem",
  lineHeight: "1.5",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

/** Tall capitals in Anton, which has one weight. */
const shout: StyleDeclarations = {
  fontFamily: display,
  fontWeight: "400",
  textTransform: "uppercase",
  lineHeight: "0.88",
  letterSpacing: "0",
  marginTop: "0",
  marginBottom: "0",
};

const picture = (illustration: string) => `/_lintel/illustrations/${illustration}.svg`;

/** A band of the page with the same side margins everywhere. */
function band(
  name: string,
  children: NodeBlueprint[],
  options: { element?: string; top?: number; bottom?: number; styles?: NodeStyles } = {},
): NodeBlueprint {
  const top = options.top ?? 8;
  const bottom = options.bottom ?? 8;
  return {
    type: "section",
    name,
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

/** A band laid out on twelve columns; on phones everything stacks in reading order. */
function gridBand(
  name: string,
  children: NodeBlueprint[],
  options: { top?: number; bottom?: number; base?: StyleDeclarations; element?: string } = {},
): NodeBlueprint {
  return {
    ...band(name, children, {
      ...options,
      styles: {
        base: { columnGap: "clamp(0.75rem, 1.6vw, 1.5rem)", rowGap: space(5), ...options.base },
      },
    }),
    placedGrid: { columns: 12, stackOnPhone: true },
  };
}

/** Where an element sits: columns `column` to `column + span - 1`, row `row` (or rows). */
function at(column: number, span: number, row: number | string, extra: StyleDeclarations = {}) {
  return { gridColumn: `${column} / span ${span}`, gridRow: String(row), ...extra };
}

function label(words: string, name = "Label", styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "text",
    name,
    props: { text: words },
    styles: { base: { ...detail, color: quiet, marginTop: "0", marginBottom: "0", ...styles } },
  };
}

function words(name: string, text: string, styles: StyleDeclarations, phone?: StyleDeclarations) {
  return {
    type: "text",
    name,
    props: { text },
    styles: { base: { marginTop: "0", marginBottom: "0", ...styles }, ...(phone ? { phone } : {}) },
  } satisfies NodeBlueprint;
}

function textLink(text: string, href: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "link",
    props: { label: text, href, openInNewTab: false },
    styles: {
      base: { ...detail, color: "inherit", textDecoration: "underline", ...styles },
      hover: { color: signal },
    },
  };
}

/** A square-cornered button: filled with the red, or outlined. */
function button(
  text: string,
  href: string,
  look: "filled" | "outline" = "filled",
  colours = { fill: signal, on: paper },
): NodeBlueprint {
  return {
    type: "button",
    props: { label: text, href, openInNewTab: false },
    styles: {
      base: {
        ...detail,
        fontWeight: "700",
        display: "inline-block",
        width: "fit-content",
        paddingTop: space(3),
        paddingBottom: space(3),
        paddingLeft: space(5),
        paddingRight: space(5),
        borderRadius: "0",
        textDecoration: "none",
        borderStyle: "solid",
        borderWidth: "2px",
        borderColor: look === "filled" ? colours.fill : "currentColor",
        backgroundColor: look === "filled" ? colours.fill : "transparent",
        color: look === "filled" ? colours.on : "inherit",
      },
      hover: { opacity: "0.85" },
    },
    animation: animate("press"),
  };
}

function row(
  name: string,
  children: NodeBlueprint[],
  styles: StyleDeclarations = {},
  phone?: StyleDeclarations,
) {
  return {
    type: "box",
    name,
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space(3),
        ...styles,
      },
      ...(phone ? { phone } : {}),
    },
    children,
  } satisfies NodeBlueprint;
}

/** The site's navigation, on every page: the band's name and the menu. */
function longplayNavigation(): NodeBlueprint {
  return band(
    "Navigation",
    [
      siteLogo("name", {
        fontFamily: display,
        fontSize: "1.5rem",
        fontWeight: "400",
        textTransform: "uppercase",
        letterSpacing: "0.01em",
        color: ink,
        textDecoration: "none",
        minHeight: "0",
      }),
      siteMenuRow({ styles: { ...detail, fontWeight: "400", color: ink } }),
      menuDrawer(),
    ],
    {
      element: "header",
      top: 4,
      bottom: 4,
      styles: {
        base: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space(5),
          borderStyle: "solid",
          borderColor: rule,
          borderWidth: "0 0 1px 0",
        },
        phone: { paddingTop: space(3), paddingBottom: space(3) },
      },
    },
  );
}

const socialLinks: readonly [string, string][] = [
  ["Instagram", "https://www.instagram.com/"],
  ["Bandcamp", "https://bandcamp.com/"],
  ["YouTube", "https://www.youtube.com/"],
  ["Spotify", "https://open.spotify.com/"],
];

/** The site's footer, on every page: the name very large, where to listen and the small print. */
function longplayFooter(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      {
        ...siteLogo("name", {
          ...shout,
          fontSize: "clamp(3.5rem, 13vw, 12rem)",
          color: ink,
          textDecoration: "none",
          minHeight: "0",
          gridColumn: "1 / span 12",
          gridRow: "1",
        }),
        name: "Band name",
      },
      {
        ...row(
          "Social links",
          [
            ...socialLinks.map(([text, href]) => textLink(text, href, { textDecoration: "none" })),
            {
              type: "cookieSettings",
              styles: { base: { ...detail, color: "inherit" }, hover: { color: signal } },
            },
          ],
          { gap: space(5), ...at(1, 8, 2) },
        ),
      },
      label(`© 2026 ${bandName}. Made in Manchester.`, "Small print", {
        ...at(9, 4, 2),
        textAlign: "right",
      }),
    ],
    {
      element: "footer",
      top: 7,
      bottom: 5,
      base: { borderStyle: "solid", borderColor: rule, borderWidth: "1px 0 0 0" },
    },
  );
}

interface Release {
  title: string;
  kind: string;
  year: string;
  illustration: string;
  alt: string;
}

const releases: readonly Release[] = [
  {
    title: "Salt Lines",
    kind: "Album, 10 songs",
    year: "2027",
    illustration: "longplay-salt-lines",
    alt: "Record sleeve: a low red sun half hidden behind thin black lines of sea",
  },
  {
    title: "Night Bus Hymns",
    kind: "EP, 4 songs",
    year: "2025",
    illustration: "longplay-night-bus",
    alt: "Record sleeve: a night bus crossing the dark, one window lit red",
  },
  {
    title: "Kingsway",
    kind: "Single",
    year: "2024",
    illustration: "longplay-kingsway",
    alt: "Record sleeve: a straight road running into the dark with a red dashed centre line",
  },
  {
    title: "Copper Rain",
    kind: "Album, 11 songs",
    year: "2023",
    illustration: "longplay-copper-rain",
    alt: "Record sleeve: pale rain slanting across a copper-coloured square",
  },
  {
    title: "Ancoats Tapes",
    kind: "EP, 5 songs",
    year: "2021",
    illustration: "longplay-ancoats",
    alt: "Record sleeve: the arched windows of an old brick mill, one of them lit red",
  },
];

interface Show {
  date: string;
  city: string;
  venue: string;
  status: "tickets" | "few" | "sold out";
}

const shows: readonly Show[] = [
  { date: "Fri 12 Mar", city: "Glasgow", venue: "The Kelvin Rooms", status: "tickets" },
  { date: "Sat 13 Mar", city: "Newcastle", venue: "Ouseburn Social", status: "few" },
  { date: "Mon 15 Mar", city: "Leeds", venue: "Wharf Street Hall", status: "tickets" },
  { date: "Wed 17 Mar", city: "Dublin", venue: "The Liberty Rooms", status: "sold out" },
  { date: "Fri 19 Mar", city: "Bristol", venue: "Harbourside Shed", status: "few" },
  { date: "Sat 20 Mar", city: "London", venue: "The Electric Hall", status: "sold out" },
  { date: "Thu 25 Mar", city: "Birmingham", venue: "Digbeth Arches", status: "tickets" },
  { date: "Sat 27 Mar", city: "Manchester", venue: "The Mill Ballroom", status: "tickets" },
];

/** One date of the tour: when, where, and tickets or "Sold out". */
function showRow(show: Show, headingLevel: number): NodeBlueprint {
  const action: NodeBlueprint =
    show.status === "sold out"
      ? label("Sold out", "Sold out", { textAlign: "right", gridColumn: "4", gridRow: "1" })
      : {
          ...button(show.status === "few" ? "Last few" : "Tickets", ticketsUrl),
          name: "Tickets",
        };
  return {
    type: "box",
    name: "Show",
    props: { element: "article" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "8rem minmax(0, 4fr) minmax(0, 3fr) 9rem",
        alignItems: "center",
        gap: space(4),
        paddingTop: space(4),
        paddingBottom: space(4),
        borderStyle: "solid",
        borderColor: rule,
        borderWidth: "1px 0 0 0",
        ...(show.status === "sold out" ? { color: quiet } : {}),
      },
      phone: {
        gridTemplateColumns: "minmax(0, 1fr) auto",
        rowGap: space(2),
      },
    },
    children: [
      label(show.date, "Date", { color: "inherit" }),
      {
        type: "heading",
        name: "City",
        props: { text: show.city, level: headingLevel },
        styles: {
          base: { ...shout, fontSize: "clamp(2rem, 4.4vw, 3.75rem)" },
          phone: { gridColumn: "1 / span 2", gridRow: "2" },
        },
      },
      words(
        "Venue",
        show.venue,
        { fontSize: "0.9375rem" },
        { gridColumn: "1 / span 2", gridRow: "3" },
      ),
      {
        ...action,
        styles: {
          ...action.styles,
          base: { ...action.styles?.base, justifySelf: "end" },
          phone: { gridColumn: "2", gridRow: "1" },
        },
      },
    ],
  };
}

function showList(list: readonly Show[], headingLevel: number): NodeBlueprint {
  return {
    type: "box",
    name: "Tour dates",
    styles: {
      base: {
        display: "flex",
        flexDirection: "column",
        borderStyle: "solid",
        borderColor: rule,
        borderWidth: "0 0 1px 0",
      },
    },
    animation: animate("stagger-up", { stagger: 60 }),
    children: list.map((show) => showRow(show, headingLevel)),
  };
}

/** The same element placed on the grid, keeping its own styles. */
function withPlace(blueprint: NodeBlueprint, place: StyleDeclarations): NodeBlueprint {
  return {
    ...blueprint,
    styles: { ...blueprint.styles, base: { ...blueprint.styles?.base, ...place } },
  };
}

function sleeve(release: Release, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "image",
    name: "Sleeve",
    props: { src: picture(release.illustration), alt: release.alt, assetId: null, caption: "" },
    styles: {
      base: { width: "100%", height: "auto", aspectRatio: "1 / 1", borderRadius: "0", ...styles },
    },
  };
}

/** The top of an inner page: a label, the title in giant capitals and a sentence. */
function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      label(copy.label, "Label", at(1, 6, 1)),
      {
        type: "heading",
        name: "Page title",
        props: { text: copy.title, level: 1 },
        styles: { base: { ...shout, ...at(1, 12, 2), fontSize: "clamp(5rem, 22vw, 22rem)" } },
        animation: animate("letters-drop"),
      },
      words("Introduction", copy.text, {
        ...at(7, 5, 3),
        fontSize: "1rem",
        lineHeight: "1.6",
        maxWidth: "34rem",
      }),
    ],
    { top: 7, bottom: 6 },
  );
}

const latest = releases[0] as Release;

const homePage = {
  slug: "home",
  title: "Home",
  summary: `${bandName}: a four-piece from Manchester. New album Salt Lines out 5 March.`,
  sections: [
    gridBand(
      "Introduction",
      [
        label("New album Salt Lines, out 5 March", "Label", {
          ...at(1, 6, 1),
          color: stage.signal,
        }),
        label("Manchester, since 2019", "Where from", {
          ...at(9, 4, 1),
          color: stage.quiet,
          textAlign: "right",
        }),
        {
          type: "heading",
          name: "Band name",
          props: { text: bandName, level: 1 },
          styles: {
            base: {
              ...shout,
              ...at(1, 12, 2),
              fontSize: "clamp(4.75rem, 19vw, 19rem)",
              lineHeight: "0.82",
              marginTop: space(6),
              color: stage.text,
            },
            phone: { marginTop: space(3) },
          },
          animation: animate("letters-drop"),
        },
        words(
          "About in a line",
          "Four friends from Levenshulme making loud, patient songs about night buses, the sea and the people who wait up for you.",
          { ...at(1, 5, 3), fontSize: "1rem", lineHeight: "1.6", color: stage.text },
        ),
        {
          ...row(
            "Buttons",
            [
              button("Listen to Salt Lines", "/music", "filled", {
                fill: stage.signal,
                on: stage.background,
              }),
              button("Tour dates", "/tour", "outline"),
            ],
            { ...at(8, 5, 3), justifyContent: "flex-end", alignSelf: "end" },
            // On phones the buttons follow the words, from the left.
            { justifyContent: "flex-start" },
          ),
          animation: animate("fade-up", { delay: 500 }),
        },
      ],
      {
        top: 7,
        bottom: 8,
        base: { backgroundColor: stage.background, color: stage.text },
      },
    ),
    band(
      "Ticker",
      [
        {
          type: "marquee",
          name: "News ticker",
          props: {
            items: [
              "Salt Lines, the new album, out 5 March",
              "Eight nights in March across the UK and Ireland",
              "Hometown show: The Mill Ballroom, 27 March",
            ],
            speed: "slow",
            direction: "left",
          },
          styles: {
            base: {
              fontFamily: display,
              textTransform: "uppercase",
              fontSize: "clamp(1.5rem, 3.6vw, 2.75rem)",
              lineHeight: "1",
            },
          },
        },
      ],
      {
        top: 3,
        bottom: 3,
        styles: {
          base: { backgroundColor: signal, color: paper, paddingLeft: "0", paddingRight: "0" },
          phone: { paddingTop: space(3), paddingBottom: space(3) },
        },
      },
    ),
    gridBand(
      "Latest release",
      [
        {
          ...sleeve(latest, at(1, 6, "1 / span 4")),
          animation: animate("mask-reveal-up"),
        },
        label("Out 5 March on Northern Spoke Records", "Label", at(8, 5, 1)),
        {
          type: "heading",
          name: "Release title",
          props: { text: latest.title, level: 2 },
          styles: { base: { ...shout, ...at(8, 5, 2), fontSize: "clamp(3.5rem, 8vw, 7.5rem)" } },
          animation: animate("words-rise"),
        },
        words(
          "About the record",
          "Ten songs written on the coast at Formby over one wet winter and recorded live, all four of us in one room, in nine days. It’s the quietest record we’ve made, and somehow the loudest.",
          { ...at(8, 5, 3), fontSize: "1rem", lineHeight: "1.6" },
        ),
        {
          ...row(
            "Listen links",
            [
              button("Bandcamp ↗", "https://bandcamp.com/", "filled"),
              button("Spotify ↗", "https://open.spotify.com/", "outline"),
              button("Apple Music ↗", "https://music.apple.com/", "outline"),
            ],
            { ...at(8, 5, 4), alignSelf: "start" },
          ),
        },
      ],
      { top: 9, bottom: 9 },
    ),
    gridBand(
      "Video",
      [
        label("Video", "Label", at(1, 3, 1)),
        {
          type: "heading",
          name: "Video title",
          props: { text: "Kingsway, live at the Mill", level: 2 },
          styles: { base: { ...shout, ...at(4, 9, 1), fontSize: "clamp(2rem, 4.4vw, 3.75rem)" } },
        },
        {
          type: "image",
          name: "Video poster",
          props: {
            src: picture("longplay-stage"),
            alt: "Drawing of an empty stage before a gig: three microphone stands, two amplifiers and a red strip of tape on the floor",
            assetId: null,
            caption: "",
          },
          styles: {
            base: {
              ...at(1, 12, 2),
              width: "100%",
              height: "auto",
              aspectRatio: "16 / 9",
              borderRadius: "0",
            },
          },
          animation: animate("fade-in"),
        },
        // Shows once it has a YouTube or Vimeo link; until then only the poster shows.
        {
          type: "video",
          name: "Video (add a YouTube or Vimeo link)",
          props: {
            source: "youtube",
            url: "",
            title: "Kingsway, live at the Mill",
            shape: "16:9",
          },
          styles: { base: { ...at(1, 12, 3), width: "100%" } },
        },
        words(
          "About the video",
          "Filmed on the last night of the Copper Rain tour, in front of eleven hundred people and most of our families.",
          { ...at(1, 5, 4), fontSize: "0.9375rem", lineHeight: "1.6", color: quiet },
        ),
        textLink("Watch on YouTube ↗", "https://www.youtube.com/", {
          ...at(10, 3, 4),
          justifySelf: "end",
        }),
      ],
      { top: 6, bottom: 9 },
    ),
    gridBand(
      "Next shows",
      [
        {
          type: "heading",
          name: "Section title",
          props: { text: "On tour in March", level: 2 },
          styles: { base: { ...shout, ...at(1, 8, 1), fontSize: "clamp(2.5rem, 6vw, 5rem)" } },
        },
        textLink("All eight dates", "/tour", {
          ...at(9, 4, 1),
          justifySelf: "end",
          alignSelf: "end",
        }),
        withPlace(showList(shows.slice(0, 3), 3), at(1, 12, 2)),
      ],
      { top: 6, bottom: 9 },
    ),
  ],
};

/** One frame of the drag gallery: the sleeve, then its title and year. */
function gallerySlide(release: Release): NodeBlueprint {
  return {
    type: "slide",
    props: { label: release.title },
    children: [
      sleeve(release),
      row(
        "Caption",
        [
          words("Title", release.title, {
            fontFamily: display,
            textTransform: "uppercase",
            fontSize: "1.5rem",
          }),
          label(release.year, "Year"),
        ],
        { justifyContent: "space-between", alignItems: "baseline", flexWrap: "nowrap" },
      ),
    ],
  };
}

/** One row of the discography, with its sleeve under the pointer. */
function releaseRow(release: Release): NodeBlueprint {
  return {
    type: "box",
    name: "Release",
    props: { element: "article" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "5rem minmax(0, 6fr) minmax(0, 3fr) 7rem",
        alignItems: "baseline",
        gap: space(4),
        paddingTop: space(5),
        paddingBottom: space(5),
        borderStyle: "solid",
        borderColor: rule,
        borderWidth: "1px 0 0 0",
      },
      hover: { color: signal },
      phone: { gridTemplateColumns: "3.5rem minmax(0, 1fr)", rowGap: space(1) },
    },
    effects: [
      { effect: "hover-picture", params: { src: picture(release.illustration), size: "medium" } },
    ],
    children: [
      label(release.year, "Year", { color: "inherit" }),
      {
        type: "heading",
        name: "Release title",
        props: { text: release.title, level: 2 },
        styles: { base: { ...shout, fontSize: "clamp(2.25rem, 5vw, 4.5rem)" } },
      },
      words("Kind", release.kind, { fontSize: "0.9375rem" }, { gridColumn: "2", gridRow: "2" }),
      {
        ...textLink("Listen ↗", "https://bandcamp.com/"),
        styles: {
          base: { ...detail, color: "inherit", textDecoration: "underline", justifySelf: "end" },
          hover: { color: signal },
          phone: { gridColumn: "2", gridRow: "3", justifySelf: "start" },
        },
      },
    ],
  };
}

const musicPage = {
  slug: "music",
  title: "Music",
  summary: `Every record ${bandName} have made, from Ancoats Tapes to Salt Lines.`,
  sections: [
    pageTop({
      label: "Discography, 2021 – 2027",
      title: "Music",
      text: "Two albums, two EPs and a single, newest first. Everything is on Bandcamp, where the most of what you pay reaches us.",
    }),
    band(
      "Sleeves",
      [
        {
          type: "carousel",
          name: "Drag gallery",
          props: {
            label: "Record sleeves",
            perView: 3,
            autoplay: false,
            autoplaySeconds: 6,
            loop: false,
            showDots: false,
            freeDrag: true,
          },
          effects: [{ effect: "cursor-word", params: { text: "Drag" } }],
          animation: animate("fade-up", { delay: 150 }),
          children: releases.map(gallerySlide),
        },
      ],
      { top: 2, bottom: 8 },
    ),
    band(
      "Discography",
      [
        {
          type: "box",
          name: "Releases",
          styles: {
            base: {
              display: "flex",
              flexDirection: "column",
              borderStyle: "solid",
              borderColor: rule,
              borderWidth: "0 0 1px 0",
            },
          },
          animation: animate("stagger-up", { stagger: 60 }),
          children: releases.map(releaseRow),
        },
      ],
      { top: 2, bottom: 9 },
    ),
  ],
};

const tourPage = {
  slug: "tour",
  title: "Tour",
  summary: `${bandName} on tour in March: eight nights across the UK and Ireland.`,
  sections: [
    pageTop({
      label: "March 2027, UK and Ireland",
      title: "Tour",
      text: "Eight nights to play Salt Lines from start to finish, then the old ones. Mary Okafor opens every show. Doors at seven.",
    }),
    band("Dates", [showList(shows, 2)], { top: 2, bottom: 8 }),
    gridBand(
      "Getting in",
      [
        {
          type: "heading",
          name: "Access title",
          props: { text: "Access", level: 2 },
          styles: { base: { ...shout, ...at(1, 3, 1), fontSize: "2rem" } },
        },
        words(
          "Access",
          "Every venue has step-free access to the main room. For accessible tickets, or a free ticket for someone who comes with you, email access@halfwaylights.example and we’ll sort it with the venue.",
          { ...at(4, 4, 1), fontSize: "0.9375rem", lineHeight: "1.6" },
        ),
        {
          type: "heading",
          name: "Resale title",
          props: { text: "Can’t go?", level: 2 },
          styles: { base: { ...shout, ...at(8, 2, 1), fontSize: "2rem" } },
        },
        words(
          "Resale",
          "Sell your ticket back at face value through the ticket seller. Please don’t buy from resale sites charging more; those tickets are often cancelled.",
          { ...at(10, 3, 1), fontSize: "0.9375rem", lineHeight: "1.6" },
        ),
      ],
      {
        top: 6,
        bottom: 9,
        base: { borderStyle: "solid", borderColor: rule, borderWidth: "1px 0 0 0" },
      },
    ),
  ],
};

const contacts: readonly [string, string, string][] = [
  ["Booking", "Rosa Achterberg, Northline Agency", "booking@halfwaylights.example"],
  ["Press", "Dev Mistry, Loud Paper PR", "press@halfwaylights.example"],
  ["Everything else", "The band", "hello@halfwaylights.example"],
];

const mailingListPage = {
  slug: "mailing-list",
  title: "Mailing list",
  summary: `Join the ${bandName} mailing list: new songs first and tour dates a day early.`,
  sections: [
    gridBand(
      "Mailing list",
      [
        label("Mailing list", "Label", at(1, 4, 1)),
        {
          type: "heading",
          name: "Page title",
          props: { text: "Letters from the van", level: 1 },
          styles: {
            base: { ...shout, ...at(1, 7, 2), fontSize: "clamp(4rem, 11vw, 11rem)" },
          },
          animation: animate("letters-drop"),
        },
        words(
          "Introduction",
          "One email a month at most: new songs before anyone else hears them, tour dates a day before they go on sale, and the odd photo from the road. Leave whenever you like.",
          { ...at(8, 5, 2), fontSize: "1rem", lineHeight: "1.6", alignSelf: "end" },
        ),
      ],
      { top: 8, bottom: 7 },
    ),
    gridBand(
      "Sign-up",
      [
        {
          type: "newsletterSignup",
          name: "Sign-up",
          props: {
            form: "newsletter",
            title: "Join the list",
            text: "We never share your address, and every email has a link to leave.",
            emailLabel: "Your email address",
            buttonLabel: "Sign me up",
          },
          styles: { base: { ...at(5, 8, 1) } },
          animation: animate("fade-up"),
        },
      ],
      // A band of its own, so a site without Forms still has the page without it.
      { top: 1, bottom: 9 },
    ),
    gridBand(
      "Contacts",
      [
        {
          type: "heading",
          name: "Section title",
          props: { text: "Get in touch", level: 2 },
          styles: { base: { ...shout, ...at(1, 12, 1), fontSize: "clamp(2.5rem, 6vw, 5rem)" } },
        },
        ...contacts.map(([title, who, email], index) => ({
          type: "box",
          name: title,
          styles: {
            base: {
              ...at(1 + index * 4, 4, 2),
              display: "flex",
              flexDirection: "column",
              gap: space(2),
              paddingTop: space(4),
              borderStyle: "solid",
              borderColor: rule,
              borderWidth: "1px 0 0 0",
            },
          },
          children: [
            label(title, "Contact title", { color: signal }),
            words("Who", who, { fontSize: "0.9375rem" }),
            textLink(email, `mailto:${email}`, { textTransform: "none", fontSize: "0.9375rem" }),
          ],
        })),
      ],
      { top: 6, bottom: 9 },
    ),
  ],
};

export const longplaySite: StarterSite = {
  id: "longplay",
  name: "Longplay",
  description:
    "A loud, dark site for a band or artist: the new record and a video up front, the discography, tour dates with tickets and a mailing list.",
  suitedTo: "Bands, singers, DJs and other musicians",
  coverIllustration: "longplay-cover",
  theme: {
    brandColour: "#b8321a",
    accentColour: "#141311",
    fontPairing: "system",
    cornerStyle: "square",
    headingFont: "Anton",
    bodyFont: "Space Mono",
  },
  siteMotion: {
    smoothScroll: { strength: "strong" },
    cursor: { style: "blend", colour: "#ffffff", size: 22 },
    pageTransition: { style: "wipe", duration: 500 },
    intro: { style: "name", text: bandName, background: stage.background, colour: stage.text },
  },
  siteSections: { navigation: longplayNavigation(), footer: longplayFooter() },
  pages: [homePage, musicPage, tourPage, mailingListPage],
};
