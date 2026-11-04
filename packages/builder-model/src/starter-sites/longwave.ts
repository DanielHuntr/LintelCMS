import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import { menuDrawer, siteLogo, siteMenuRow } from "../sections/site-navigation.js";
import type { StarterCollection, StarterSite } from "./starter-site.js";

/**
 * Longwave: the site of a weekly interview podcast, "Second Hands", about people who repair
 * and restore things, recorded in Cardiff. Deep ink-blue and cream that swap places in dark
 * mode, one amber for what to press, Syne for the wide headings and DM Sans for reading.
 * The episodes are a collection (Content → Episodes), so a new episode is a new entry and
 * the Episodes page lists it by itself; the home page features the latest one by hand.
 */

// Colours follow the visitor's light or dark setting (CSS light-dark).
const paper = "light-dark(#f4eee0, #0f1a2e)";
const ink = "light-dark(#13213a, #f1ead9)";
/** 7:1 on the paper in both modes. */
const quiet = "light-dark(#4a5670, #aab3c5)";
/** The one accent: 5.3:1 on the light paper, 8:1 on the dark. */
const amber = "light-dark(#8a5a00, #e0a83a)";
const rule = "light-dark(#d8ccb0, #263553)";
const panel = "light-dark(#ebe2cd, #16243d)";

const showName = "Second Hands";
const email = "hello@secondhands.example";

const listenLinks = [
  { label: "Apple Podcasts", href: "https://podcasts.apple.com/" },
  { label: "Spotify", href: "https://open.spotify.com/" },
  { label: "Pocket Casts", href: "https://pocketcasts.com/" },
  { label: "RSS feed", href: "https://secondhands.example/feed.xml" },
];

/** Small capitals for labels, numbers and dates. */
const detail: StyleDeclarations = {
  fontSize: "0.8125rem",
  fontWeight: "700",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  lineHeight: "1.4",
};

/** The wide display type, in the heading font. */
const display: StyleDeclarations = {
  fontWeight: "700",
  lineHeight: "0.92",
  letterSpacing: "-0.03em",
  marginTop: "0",
  marginBottom: "0",
};

const picture = (name: string) => `/_lintel/illustrations/${name}.svg`;

/** A band of the page with the same side margins everywhere. */
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
        paddingLeft: "clamp(1.25rem, 4vw, 3.5rem)",
        paddingRight: "clamp(1.25rem, 4vw, 3.5rem)",
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
  bandName: string,
  children: NodeBlueprint[],
  options: { element?: string; top?: number; bottom?: number; styles?: NodeStyles } = {},
): NodeBlueprint {
  return {
    ...band(bandName, children, {
      ...options,
      styles: {
        ...options.styles,
        base: { columnGap: "clamp(0.75rem, 2vw, 2rem)", rowGap: space(5), ...options.styles?.base },
      },
    }),
    placedGrid: { columns: 12, stackOnPhone: true },
  };
}

/** Columns `column` to `column + span - 1`, rows `row` onwards. */
function at(column: number, span: number, row: number, rowSpan = 1): StyleDeclarations {
  return {
    gridColumn: `${column} / span ${span}`,
    gridRow: rowSpan > 1 ? `${row} / span ${rowSpan}` : String(row),
  };
}

function label(words: string, labelName = "Label", styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "text",
    name: labelName,
    props: { text: words },
    styles: { base: { ...detail, color: quiet, marginTop: "0", marginBottom: "0", ...styles } },
  };
}

function words(name: string, text: string, styles: NodeStyles): NodeBlueprint {
  return { type: "text", name, props: { text }, styles };
}

function title(name: string, text: string, level: number, styles: NodeStyles): NodeBlueprint {
  return { type: "heading", name, props: { text, level }, styles };
}

function link(words: string, href: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "link",
    props: { label: words, href, openInNewTab: false },
    styles: {
      base: { color: ink, textDecoration: "none", ...styles },
      hover: { color: amber },
    },
  };
}

function image(name: string, illustration: string, alt: string, styles: NodeStyles): NodeBlueprint {
  return {
    type: "image",
    name,
    props: { src: picture(illustration), alt, assetId: null, caption: "" },
    styles: {
      ...styles,
      base: { width: "100%", height: "auto", borderRadius: "1.25rem", ...styles.base },
    },
  };
}

/** The amber button: dark letters on amber in both modes (7.8:1 and 9.4:1). */
function amberButton(words: string, href: string): NodeBlueprint {
  return {
    type: "button",
    name: "Button",
    props: { label: words, href, openInNewTab: false },
    styles: {
      base: {
        display: "inline-block",
        width: "fit-content",
        backgroundColor: "light-dark(#d99a1e, #e0a83a)",
        color: "#13213a",
        fontWeight: "700",
        textDecoration: "none",
        paddingTop: space(3),
        paddingBottom: space(3),
        paddingLeft: space(5),
        paddingRight: space(5),
        borderRadius: "999px",
      },
      hover: { opacity: "0.88" },
    },
    animation: animate("press"),
  };
}

/** The places to listen, as a row of plain links. */
function listenRow(styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "box",
    name: "Where to listen",
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: space(5),
        rowGap: space(2),
        ...styles,
      },
    },
    children: listenLinks.map((place) =>
      link(`${place.label} ↗`, place.href, {
        fontWeight: "600",
        textDecoration: "underline",
      }),
    ),
  };
}

// The navigation and footer, on every page of the site.

function navigation(): NodeBlueprint {
  return band(
    "Navigation",
    [
      siteLogo("name", {
        color: ink,
        textDecoration: "none",
        fontFamily: "'Syne', sans-serif",
        fontWeight: "800",
        fontSize: "1.125rem",
        letterSpacing: "-0.01em",
        minHeight: "0",
      }),
      {
        type: "box",
        name: "Menu and button",
        styles: {
          base: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: space(5),
          },
        },
        children: [siteMenuRow({ styles: { color: ink, fontWeight: "500" } }), menuDrawer()],
      },
    ],
    {
      element: "header",
      top: 4,
      bottom: 4,
      styles: {
        base: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: space(4),
          borderStyle: "solid",
          borderColor: rule,
          borderWidth: "0 0 1px 0",
        },
        phone: { paddingTop: space(3), paddingBottom: space(3) },
      },
    },
  );
}

function footer(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      words("Footer title", "New episodes every Tuesday morning.", {
        base: {
          ...at(1, 7, 1),
          ...display,
          fontSize: "clamp(1.75rem, 3.6vw, 3rem)",
          lineHeight: "1.05",
        },
      }),
      { ...listenRow(), styles: { base: { ...listenRow().styles?.base, ...at(1, 7, 2) } } },
      {
        type: "box",
        name: "Write to us",
        styles: {
          base: {
            ...at(9, 4, 1, 2),
            display: "flex",
            flexDirection: "column",
            gap: space(2),
            alignSelf: "start",
          },
        },
        children: [
          label("Write to us", "Email label"),
          link(email, `mailto:${email}`, { fontSize: "1.0625rem" }),
          {
            type: "cookieSettings",
            styles: {
              base: { color: quiet, textDecoration: "underline" },
              hover: { color: amber },
            },
          },
        ],
      },
      label(`© 2026 ${showName}. Recorded in Splott, Cardiff.`, "Small print", {
        ...at(1, 12, 3),
        fontWeight: "400",
        letterSpacing: "0.04em",
        paddingTop: space(4),
        borderStyle: "solid",
        borderColor: rule,
        borderWidth: "1px 0 0 0",
      }),
    ],
    {
      element: "footer",
      top: 7,
      bottom: 5,
      styles: {
        base: {
          backgroundColor: panel,
          borderStyle: "solid",
          borderColor: rule,
          borderWidth: "1px 0 0 0",
        },
      },
    },
  );
}

// The episodes: a collection, so new ones are added in Content → Episodes.

interface Episode {
  number: string;
  title: string;
  slug: string;
  guest: string;
  length: string;
  date: string;
  summary: string;
  illustration: string;
  alt: string;
}

const episodes: readonly Episode[] = [
  {
    number: "48",
    title: "The clockmaker who won’t use a screwdriver",
    slug: "the-clockmaker",
    guest: "Elin Pryce, clock restorer, Llandeilo",
    length: "52 min",
    date: "3 November 2026",
    summary:
      "Elin has restored long-case clocks for thirty years and still makes her own tools. We talk about brass, beeswax and the clock she has been failing to finish since 1998.",
    illustration: "longwave-clock",
    alt: "Episode cover: a clock face with cream hour marks and an amber hand on deep blue",
  },
  {
    number: "47",
    title: "Bringing a 1962 Vespa home",
    slug: "a-1962-vespa",
    guest: "Marco Bellini, scooter mechanic, Newport",
    length: "47 min",
    date: "27 October 2026",
    summary:
      "Marco bought a rusted scooter for forty pounds and spent two winters putting it back on the road. Parts, patience and why he refuses to repaint it.",
    illustration: "longwave-wheel",
    alt: "Episode cover: a spoked wheel with an amber hub on deep blue",
  },
  {
    number: "46",
    title: "Sashes, putty and patience",
    slug: "sashes-putty-and-patience",
    guest: "Hannah Lowe, sash window joiner, Penarth",
    length: "55 min",
    date: "20 October 2026",
    summary:
      "Hannah saves Victorian windows that landlords want to rip out. She explains weights and pulleys, and why a hundred-year-old window can outlast a new one.",
    illustration: "longwave-window",
    alt: "Episode cover: a tall sash window in dark blue panes with an amber sill",
  },
  {
    number: "45",
    title: "A cello in forty pieces",
    slug: "a-cello-in-forty-pieces",
    guest: "Tomasz Wilk, violin and cello maker, Cardiff",
    length: "61 min",
    date: "13 October 2026",
    summary:
      "A cello arrived at Tomasz’s workshop in a bin bag after a car door closed on it. This is the story of the eight months it took to make it sing again.",
    illustration: "longwave-cello",
    alt: "Episode cover: an amber cello with four cream strings on deep blue",
  },
  {
    number: "44",
    title: "The repair café in the old chapel",
    slug: "the-repair-cafe",
    guest: "Bethan and Gwyn Morgan, Grangetown Repair Café",
    length: "49 min",
    date: "6 October 2026",
    summary:
      "Once a month, a chapel in Grangetown fills with broken toasters, lamps and jumpers. Bethan and Gwyn on running it for six years with volunteers and tea.",
    illustration: "longwave-kettle",
    alt: "Episode cover: a dark kettle with an amber lid on a cream table",
  },
  {
    number: "43",
    title: "Darning in public",
    slug: "darning-in-public",
    guest: "Amira Haddad, visible mender, Swansea",
    length: "44 min",
    date: "29 September 2026",
    summary:
      "Amira mends jumpers on the train and lets strangers watch. We talk about making a repair you are proud to show rather than one you hide.",
    illustration: "longwave-needle",
    alt: "Episode cover: a square of cream darning threads with an amber needle",
  },
];

const latest = episodes[0] as Episode;

export const episodesCollection: StarterCollection = {
  handle: "episodes",
  name: "Episodes",
  itemName: "Episode",
  fields: [
    { handle: "number", label: "Episode number", type: "text" },
    {
      handle: "guest",
      label: "Guest",
      type: "text",
      helpText: "Their name, what they do and where",
    },
    { handle: "length", label: "Length", type: "text", helpText: "Such as 52 min" },
    { handle: "date", label: "Date out", type: "text" },
    { handle: "summary", label: "Summary", type: "textarea" },
    {
      handle: "picture",
      label: "Cover picture address",
      type: "text",
      helpText: "The address of the episode’s square cover picture",
    },
    { handle: "picture_alt", label: "What the cover shows", type: "text" },
  ],
  entries: episodes.map((episode) => ({
    title: episode.title,
    slug: episode.slug,
    data: {
      number: `No. ${episode.number}`,
      guest: episode.guest,
      length: episode.length,
      date: episode.date,
      summary: episode.summary,
      picture: picture(episode.illustration),
      picture_alt: episode.alt,
    },
  })),
};

/** How each episode in the list looks: drawn once, filled from each entry. */
function episodeDesign(): NodeBlueprint {
  return {
    type: "card",
    name: "Episode",
    props: { href: "", look: "plain" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
        columnGap: space(5),
        rowGap: space(2),
        alignItems: "start",
        paddingTop: space(5),
        paddingBottom: space(5),
        borderStyle: "solid",
        borderColor: rule,
        borderWidth: "1px 0 0 0",
        backgroundColor: "transparent",
        color: ink,
      },
      phone: { gridTemplateColumns: "minmax(0, 1fr)" },
    },
    children: [
      {
        type: "image",
        name: "Cover",
        props: {
          src: picture(latest.illustration),
          alt: latest.alt,
          assetId: null,
          caption: "",
        },
        bindings: { src: "data.picture", alt: "data.picture_alt" },
        styles: {
          base: {
            width: "100%",
            height: "auto",
            aspectRatio: "1 / 1",
            borderRadius: "1rem",
            gridRow: "1 / span 5",
          },
          phone: { gridRow: "auto" },
        },
      },
      {
        type: "text",
        name: "Number and date",
        props: { text: "No. 48" },
        bindings: { text: "data.number" },
        styles: { base: { ...detail, color: amber, marginTop: "0", marginBottom: "0" } },
      },
      {
        type: "heading",
        name: "Episode title",
        props: { text: latest.title, level: 2 },
        bindings: { text: "title" },
        styles: {
          base: {
            ...display,
            fontSize: "clamp(1.375rem, 2.2vw, 1.875rem)",
            lineHeight: "1.1",
            letterSpacing: "-0.02em",
          },
        },
      },
      {
        type: "text",
        name: "Guest",
        props: { text: latest.guest },
        bindings: { text: "data.guest" },
        styles: { base: { fontWeight: "600", marginTop: "0", marginBottom: "0" } },
      },
      {
        type: "text",
        name: "Summary",
        props: { text: latest.summary },
        bindings: { text: "data.summary" },
        styles: { base: { color: quiet, lineHeight: "1.55", marginTop: "0", marginBottom: "0" } },
      },
      {
        type: "text",
        name: "Length",
        props: { text: latest.length },
        bindings: { text: "data.length" },
        styles: { base: { ...detail, color: quiet, marginTop: "0", marginBottom: "0" } },
      },
    ],
  };
}

// The pages.

const homePage = {
  slug: "home",
  title: "Home",
  summary: `${showName}: a weekly podcast about people who repair and restore things, recorded in Cardiff.`,
  sections: [
    gridBand(
      "Introduction",
      [
        label("A weekly podcast about mending things", "Label", at(1, 6, 1)),
        label("Recorded in Cardiff", "Where", { ...at(9, 4, 1), textAlign: "right" }),
        {
          ...title("Show name", showName, 1, {
            base: {
              ...at(1, 12, 2),
              ...display,
              fontSize: "clamp(3.5rem, 15vw, 15rem)",
              lineHeight: "0.85",
              letterSpacing: "-0.045em",
              marginTop: space(4),
            },
            phone: { marginTop: space(2) },
          }),
          animation: animate("letters-drop"),
        },
        {
          ...words(
            "About the show",
            "Every Tuesday, Ffion Rees and Dev Okafor sit down with someone who fixes what everyone else throws away: clocks, cellos, kettles, sash windows and, once, a chapel full of toasters.",
            {
              base: {
                ...at(1, 6, 3),
                fontSize: "clamp(1.125rem, 1.6vw, 1.375rem)",
                lineHeight: "1.5",
                maxWidth: "36rem",
              },
            },
          ),
          animation: animate("fade-up", { delay: 300 }),
        },
        {
          type: "box",
          name: "Buttons",
          styles: {
            base: {
              ...at(8, 5, 3),
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              alignSelf: "end",
              gap: space(4),
            },
          },
          children: [
            amberButton("Play the latest episode", "#latest"),
            link("All episodes", "/episodes", {
              fontWeight: "600",
              textDecoration: "underline",
            }),
          ],
        },
        {
          ...image(
            "Waveform",
            "longwave-waveform",
            "A cream sound waveform across a deep blue band, with an amber playhead in the middle",
            { base: { ...at(1, 12, 4), marginTop: space(5), borderRadius: "1.5rem" } },
          ),
          animation: animate("mask-reveal-right", { delay: 200 }),
        },
      ],
      { top: 7, bottom: 6 },
    ),
    {
      ...gridBand(
        "Latest episode",
        [
          {
            ...image("Episode cover", latest.illustration, latest.alt, {
              base: { ...at(1, 5, 1, 4), alignSelf: "start" },
            }),
            effects: [{ effect: "cursor-word", params: { text: "Listen" } }],
            animation: animate("scale-in"),
          },
          label(`Latest episode · No. ${latest.number}`, "Label", {
            ...at(7, 6, 1),
            color: amber,
          }),
          {
            ...title("Episode title", latest.title, 2, {
              base: {
                ...at(7, 6, 2),
                ...display,
                fontSize: "clamp(2rem, 4.4vw, 4rem)",
                lineHeight: "1",
              },
            }),
            animation: animate("words-rise"),
          },
          words("Episode summary", `With ${latest.guest}. ${latest.summary}`, {
            base: { ...at(7, 5, 3), fontSize: "1.0625rem", lineHeight: "1.6" },
          }),
          {
            type: "box",
            name: "Listen to it",
            styles: {
              base: {
                ...at(7, 6, 4),
                display: "flex",
                flexDirection: "column",
                gap: space(3),
                alignSelf: "start",
              },
            },
            children: [label(`${latest.length} · ${latest.date}`, "Length and date"), listenRow()],
          },
        ],
        {
          top: 8,
          bottom: 8,
          styles: {
            base: {
              borderStyle: "solid",
              borderColor: rule,
              borderWidth: "1px 0 0 0",
            },
          },
        },
      ),
      props: { element: "section", anchor: "latest" },
    },
    gridBand(
      "From the hosts",
      [
        label("Why we make it", "Label", at(1, 3, 1)),
        {
          ...words(
            "Statement",
            "We started the show after a man in Caerphilly fixed our broken radio for the price of a cup of tea and talked for an hour about valves. Everyone has a story about the person who mended something for them. These are their stories.",
            {
              base: {
                ...at(4, 8, 1),
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(1.375rem, 2.6vw, 2.25rem)",
                lineHeight: "1.25",
                letterSpacing: "-0.015em",
              },
            },
          ),
          animation: animate("fade-up"),
        },
        link("Meet Ffion and Dev", "/hosts", {
          ...at(4, 4, 2),
          fontWeight: "600",
          textDecoration: "underline",
        }),
      ],
      { top: 6, bottom: 9 },
    ),
  ],
};

const episodesPage = {
  slug: "episodes",
  title: "Episodes",
  summary: `Every episode of ${showName}, newest first.`,
  sections: [
    gridBand(
      "Page title",
      [
        label("The archive", "Label", at(1, 4, 1)),
        {
          ...title("Page title", "Episodes", 1, {
            base: {
              ...at(1, 9, 2),
              ...display,
              fontSize: "clamp(3rem, 11vw, 10rem)",
              lineHeight: "0.88",
            },
          }),
          animation: animate("letters-drop"),
        },
        {
          ...words(
            "Introduction",
            "Forty-eight conversations so far, about an hour each. Start anywhere: each one stands on its own.",
            {
              base: { ...at(8, 5, 3), fontSize: "1.125rem", lineHeight: "1.5", maxWidth: "30rem" },
            },
          ),
          animation: animate("fade-in", { delay: 300 }),
        },
      ],
      { top: 8, bottom: 5 },
    ),
    band(
      "Episode list",
      [
        {
          type: "collectionList",
          name: "Episode list",
          props: {
            collection: episodesCollection.handle,
            term: "",
            sort: "manual",
            limit: 12,
            paginate: true,
            columns: 2,
            tabletColumns: 1,
            phoneColumns: 1,
            emptyText: "No episodes yet. Add your first in Content → Episodes.",
            skipCurrent: false,
          },
          styles: { base: { columnGap: space(7), rowGap: "0" } },
          animation: animate("stagger-up", { stagger: 70 }),
          children: [episodeDesign()],
        },
      ],
      { top: 2, bottom: 9 },
    ),
  ],
};

interface Host {
  name: string;
  role: string;
  bio: string;
  illustration: string;
  alt: string;
}

const hosts: readonly Host[] = [
  {
    name: "Ffion Rees",
    role: "Host and producer",
    bio: "Ffion spent ten years producing radio documentaries before deciding she would rather talk to people with soldering irons. She edits every episode at her kitchen table and owns three typewriters, two of which work.",
    illustration: "longwave-host-ffion",
    alt: "Illustration of Ffion: dark hair, amber headphones, a slate-blue jumper",
  },
  {
    name: "Dev Okafor",
    role: "Host",
    bio: "Dev is a bicycle mechanic in Roath who has never met a seized bolt he couldn’t free. He asks the questions he actually wants answered, which is usually how the thing works.",
    illustration: "longwave-host-dev",
    alt: "Illustration of Dev: round glasses, a short beard and an amber shirt",
  },
];

function hostBlock(host: Host, index: number): NodeBlueprint[] {
  const column = index === 0 ? 1 : 7;
  const offset = index === 0 ? 0 : 1;
  return [
    {
      ...image(`${host.name} portrait`, host.illustration, host.alt, {
        base: { ...at(column, 5, 1 + offset), borderRadius: "999px 999px 1.25rem 1.25rem" },
      }),
      animation: animate("mask-reveal-up", { delay: index * 150 }),
    },
    {
      type: "box",
      name: host.name,
      styles: {
        base: {
          ...at(column, 5, 2 + offset),
          display: "flex",
          flexDirection: "column",
          gap: space(2),
        },
      },
      children: [
        title("Host name", host.name, 2, {
          base: { ...display, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", lineHeight: "1" },
        }),
        label(host.role, "Role", { color: amber }),
        words("Biography", host.bio, { base: { lineHeight: "1.6", marginTop: space(2) } }),
      ],
    },
  ];
}

const hostsPage = {
  slug: "hosts",
  title: "Hosts",
  summary: `Ffion Rees and Dev Okafor, who make ${showName} in Cardiff.`,
  sections: [
    gridBand(
      "Page title",
      [
        label("The hosts", "Label", at(1, 4, 1)),
        {
          ...title("Page title", "Two people who can’t leave things alone.", 1, {
            base: {
              ...at(1, 10, 2),
              ...display,
              fontSize: "clamp(2.5rem, 7vw, 6.5rem)",
            },
          }),
          animation: animate("words-rise"),
        },
      ],
      { top: 8, bottom: 4 },
    ),
    gridBand("Hosts", [...hostBlock(hosts[0] as Host, 0), ...hostBlock(hosts[1] as Host, 1)], {
      top: 5,
      bottom: 8,
    }),
    gridBand(
      "How it’s made",
      [
        title("Section title", "How it’s made", 2, {
          base: { ...at(1, 3, 1), ...detail, color: quiet },
        }),
        {
          ...words(
            "Facts",
            "Recorded in a converted bakery in Splott\nOne microphone each, one in the middle for the guest\nNo music beds, no adverts read by us\nOut every Tuesday at 6 in the morning",
            {
              base: {
                ...at(4, 8, 1),
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(1.25rem, 2.2vw, 1.875rem)",
                lineHeight: "1.45",
                whiteSpace: "pre-line",
              },
            },
          ),
          animation: animate("fade-up"),
        },
      ],
      {
        top: 7,
        bottom: 9,
        styles: { base: { borderStyle: "solid", borderColor: rule, borderWidth: "1px 0 0 0" } },
      },
    ),
  ],
};

const listenPage = {
  slug: "listen",
  title: "Listen",
  summary: `Where to listen to ${showName}, and how to suggest a guest.`,
  sections: [
    gridBand(
      "Page title",
      [
        label("Listen and subscribe", "Label", at(1, 4, 1)),
        {
          ...title("Page title", "Wherever you listen.", 1, {
            base: {
              ...at(1, 9, 2),
              ...display,
              fontSize: "clamp(2.75rem, 8vw, 7.5rem)",
            },
          }),
          animation: animate("words-rise"),
        },
        {
          ...image(
            "Microphone",
            "longwave-microphone",
            "A cream microphone with an amber stand inside a dark blue circle",
            { base: { ...at(10, 3, 1, 3), alignSelf: "end", borderRadius: "999px" } },
          ),
          animation: animate("scale-in", { delay: 200 }),
        },
      ],
      { top: 8, bottom: 5 },
    ),
    band(
      "Listening apps",
      [
        {
          type: "box",
          name: "Apps",
          styles: {
            base: {
              display: "flex",
              flexDirection: "column",
              borderStyle: "solid",
              borderColor: rule,
              borderWidth: "0 0 1px 0",
            },
          },
          animation: animate("stagger-up", { stagger: 80 }),
          children: listenLinks.map((place) => ({
            ...link(`${place.label} ↗`, place.href, {
              display: "block",
              fontFamily: "'Syne', sans-serif",
              fontWeight: "700",
              fontSize: "clamp(1.75rem, 5vw, 4rem)",
              lineHeight: "1.1",
              letterSpacing: "-0.03em",
              paddingTop: space(4),
              paddingBottom: space(4),
              borderStyle: "solid",
              borderColor: rule,
              borderWidth: "1px 0 0 0",
            }),
            name: place.label,
          })),
        },
        words(
          "Feed address",
          "Using another app? Paste the feed address into it: secondhands.example/feed.xml",
          { base: { color: quiet, marginTop: space(2) } },
        ),
      ],
      {
        top: 3,
        bottom: 8,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(3) } },
      },
    ),
    gridBand(
      "Suggest a guest",
      [
        title("Section title", "Know someone who mends things?", 2, {
          base: {
            ...at(1, 7, 1),
            ...display,
            fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
            lineHeight: "1.05",
          },
        }),
        words(
          "How to suggest",
          "Tell us who they are, what they fix and where to find them. We read everything, and about half our guests came from listeners.",
          { base: { ...at(1, 6, 2), fontSize: "1.0625rem", lineHeight: "1.6" } },
        ),
        {
          ...link(email, `mailto:${email}`, {
            ...at(1, 12, 3),
            fontFamily: "'Syne', sans-serif",
            fontWeight: "700",
            fontSize: "clamp(1.25rem, 5vw, 4.5rem)",
            letterSpacing: "-0.03em",
            color: amber,
          }),
          name: "Email",
          effects: [{ effect: "cursor-word", params: { text: "Write" } }],
          animation: animate("mask-reveal-up"),
        },
      ],
      {
        top: 8,
        bottom: 9,
        styles: { base: { backgroundColor: panel } },
      },
    ),
  ],
};

export const longwaveSite: StarterSite = {
  id: "longwave",
  name: "Longwave",
  description:
    "A podcast site with the latest episode up front, an episode list that fills itself from Content, the hosts and every place to listen.",
  suitedTo: "Podcasts, radio shows and audio series",
  coverIllustration: "longwave-cover",
  theme: {
    brandColour: "#13213a",
    accentColour: "#d99a1e",
    fontPairing: "geometric",
    cornerStyle: "soft",
    headingFont: "Syne",
    bodyFont: "DM Sans",
  },
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "ring", colour: "text", size: 30 },
    pageTransition: { style: "slide", duration: 450 },
    intro: { style: "name", text: showName, background: "#0f1a2e", colour: "#f1ead9" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  collections: [episodesCollection],
  pages: [homePage, episodesPage, hostsPage, listenPage],
};
