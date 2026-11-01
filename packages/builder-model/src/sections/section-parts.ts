import { findPreset } from "@lintel/motion/presets";
import type { NodeBlueprint } from "../components/component-definition.js";
import type {
  NodeAnimation,
  NodeStyles,
  StyleDeclarations,
} from "../document/page-document.schema.js";

/**
 * The small pieces every ready-made section is built from: containers, headings, text,
 * buttons, cards and grids, styled with the theme's tokens so they follow the site's colours,
 * fonts, corners and spacing. Sections and starter sites read as plain trees of these.
 */

export const space = (step: number) => `var(--lintel-space-${step})`;
export const colour = (name: string) => `var(--lintel-color-${name})`;
export const radius = (name: "small" | "medium" | "large" | "button") =>
  `var(--lintel-radius-${name})`;

/** A preset from `@lintel/motion`, optionally slowed down or delayed. */
export function animate(
  presetId: string,
  changes: { delay?: number; duration?: number; stagger?: number } = {},
): NodeAnimation {
  const preset = findPreset(presetId);
  if (!preset) throw new Error(`There is no animation preset called “${presetId}”.`);
  const spec = { ...preset.spec };
  if (changes.delay !== undefined) spec.delay = changes.delay;
  if (changes.duration !== undefined) spec.duration = changes.duration;
  if (changes.stagger !== undefined) spec.stagger = { ...spec.stagger, each: changes.stagger };
  return { spec, presetId };
}

interface Extras {
  name?: string;
  styles?: NodeStyles;
  animation?: NodeAnimation;
}

function withExtras(blueprint: NodeBlueprint, extras: Extras = {}): NodeBlueprint {
  return {
    ...blueprint,
    ...(extras.name ? { name: extras.name } : {}),
    ...(extras.styles ? { styles: extras.styles } : {}),
    ...(extras.animation ? { animation: extras.animation } : {}),
  };
}

/** A band across the page. `tone` picks its background: the page, a panel, or the brand. */
export function section(
  name: string,
  children: NodeBlueprint[],
  options: { tone?: "page" | "panel" | "brand" | "dark"; padding?: number; element?: string } = {},
): NodeBlueprint {
  const padding = options.padding ?? 8;
  const tones: Record<string, StyleDeclarations> = {
    page: {},
    panel: { backgroundColor: colour("surface") },
    brand: { backgroundColor: colour("brand"), color: colour("on-brand") },
    dark: { backgroundColor: colour("text"), color: colour("background") },
  };
  return {
    type: "section",
    name,
    props: { element: options.element ?? "section", anchor: "" },
    styles: {
      base: {
        paddingTop: space(padding),
        paddingBottom: space(padding),
        paddingLeft: space(5),
        paddingRight: space(5),
        ...tones[options.tone ?? "page"],
      },
      phone: { paddingTop: space(padding - 1), paddingBottom: space(padding - 1) },
    },
    children,
  };
}

/** Centres its content and keeps lines a comfortable length. */
export function container(
  children: NodeBlueprint[],
  options: { width?: string; centred?: boolean; gap?: number } = {},
): NodeBlueprint {
  return {
    type: "container",
    styles: {
      base: {
        display: "flex",
        flexDirection: "column",
        gap: space(options.gap ?? 5),
        maxWidth: options.width ?? "72rem",
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
        ...(options.centred ? { alignItems: "center", textAlign: "center" } : {}),
      },
    },
    children,
  };
}

export function heading(text: string, level: number, extras?: Extras): NodeBlueprint {
  return withExtras({ type: "heading", props: { text, level } }, extras);
}

/** A big display heading for heroes, sized down on phones. */
export function displayHeading(text: string, extras: Extras = {}): NodeBlueprint {
  return withExtras(
    { type: "heading", name: "Hero title", props: { text, level: 1 } },
    {
      styles: {
        base: {
          fontSize: "clamp(2.5rem, 6vw, 4.25rem)",
          lineHeight: "1.05",
          letterSpacing: "-0.02em",
        },
      },
      ...extras,
    },
  );
}

export function text(words: string, extras?: Extras): NodeBlueprint {
  return withExtras({ type: "text", props: { text: words } }, extras);
}

/** A slightly larger paragraph that introduces a section. */
export function lead(words: string, extras: Extras = {}): NodeBlueprint {
  return withExtras(
    { type: "text", name: "Introduction", props: { text: words } },
    {
      styles: { base: { fontSize: "1.25rem", lineHeight: "1.5" } },
      ...extras,
    },
  );
}

/** A small label above a heading, such as "Our menu". */
export function eyebrow(words: string): NodeBlueprint {
  return {
    type: "text",
    name: "Label",
    props: { text: words },
    styles: {
      base: {
        fontSize: "0.8125rem",
        fontWeight: "700",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: colour("brand"),
      },
    },
  };
}

export function button(
  label: string,
  href: string,
  variant: "solid" | "outline" | "inverse" = "solid",
  extras: Extras = {},
): NodeBlueprint {
  const looks: Record<string, StyleDeclarations> = {
    solid: { backgroundColor: colour("brand"), color: colour("on-brand") },
    outline: {
      backgroundColor: "transparent",
      color: "inherit",
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: "currentColor",
    },
    inverse: { backgroundColor: colour("on-brand"), color: colour("brand") },
  };
  return withExtras(
    {
      type: "button",
      props: { label, href, openInNewTab: false },
      styles: {
        base: {
          display: "inline-block",
          paddingTop: space(3),
          paddingBottom: space(3),
          paddingLeft: space(5),
          paddingRight: space(5),
          borderRadius: radius("button"),
          fontWeight: "600",
          textDecoration: "none",
          width: "fit-content",
          ...looks[variant],
        },
        hover: { opacity: "0.88" },
      },
    },
    { animation: animate("press"), ...extras },
  );
}

/** Buttons side by side, wrapping on small screens. */
export function buttonRow(buttons: NodeBlueprint[], centred = false): NodeBlueprint {
  return {
    type: "box",
    name: "Buttons",
    styles: {
      base: {
        display: "flex",
        flexWrap: "wrap",
        gap: space(3),
        ...(centred ? { justifyContent: "center" } : {}),
      },
    },
    children: buttons,
  };
}

/** A picture from the site's illustrations, served by the website at /_lintel/illustrations. */
export function illustration(name: string, alt: string, extras: Extras = {}): NodeBlueprint {
  return withExtras(
    {
      type: "image",
      props: { src: `/_lintel/illustrations/${name}.svg`, alt, assetId: null, caption: "" },
      styles: {
        base: { width: "100%", height: "auto", borderRadius: radius("large") },
      },
    },
    extras,
  );
}

/** A grid of equal columns that drops to two on tablets and one on phones. */
export function grid(
  columns: number,
  children: NodeBlueprint[],
  extras: Extras & { gap?: number; align?: string } = {},
): NodeBlueprint {
  return withExtras(
    {
      type: "columns",
      name: extras.name ?? "Grid",
      styles: {
        base: {
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: space(extras.gap ?? 5),
          ...(extras.align ? { alignItems: extras.align } : {}),
        },
        tablet: {
          gridTemplateColumns: `repeat(${Math.min(columns, 2)}, minmax(0, 1fr))`,
        },
        phone: { gridTemplateColumns: "minmax(0, 1fr)" },
      },
      children,
    },
    { animation: extras.animation },
  );
}

/** Two halves side by side; on phones the second goes underneath. */
export function split(
  first: NodeBlueprint,
  second: NodeBlueprint,
  ratio = "1fr 1fr",
): NodeBlueprint {
  return {
    type: "columns",
    name: "Two halves",
    styles: {
      base: { display: "grid", gridTemplateColumns: ratio, gap: space(7), alignItems: "center" },
      phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
    },
    children: [first, second],
  };
}

/** A group of elements stacked with even space between them. */
export function stack(
  name: string,
  children: NodeBlueprint[],
  gap = 4,
  extras: Extras = {},
): NodeBlueprint {
  return withExtras(
    {
      type: "box",
      name,
      styles: { base: { display: "flex", flexDirection: "column", gap: space(gap) } },
      children,
    },
    extras,
  );
}

/** A rounded panel holding a few elements: features, plans, quotes. */
export function card(
  name: string,
  children: NodeBlueprint[],
  options: { tone?: "panel" | "page" | "brand"; element?: string } = {},
): NodeBlueprint {
  const tones: Record<string, StyleDeclarations> = {
    panel: { backgroundColor: colour("surface") },
    page: {
      backgroundColor: colour("background"),
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: colour("border"),
    },
    brand: { backgroundColor: colour("brand"), color: colour("on-brand") },
  };
  return {
    type: "box",
    name,
    props: { element: options.element ?? "article" },
    styles: {
      base: {
        display: "flex",
        flexDirection: "column",
        gap: space(3),
        paddingTop: space(6),
        paddingBottom: space(6),
        paddingLeft: space(6),
        paddingRight: space(6),
        borderRadius: radius("large"),
        ...tones[options.tone ?? "panel"],
      },
    },
    children,
  };
}

/** A round badge with a number or a short word, for steps and features. */
export function badge(label: string): NodeBlueprint {
  return {
    type: "text",
    name: "Badge",
    props: { text: label },
    styles: {
      base: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2.75rem",
        height: "2.75rem",
        borderRadius: "999px",
        backgroundColor: colour("brand"),
        color: colour("on-brand"),
        fontWeight: "700",
      },
    },
  };
}

/** A block of plain colour, for when a picture would only decorate. */
export function colourBlock(
  name: string,
  tone: "brand" | "accent" | "surface",
  ratio = "4 / 3",
  width = "100%",
): NodeBlueprint {
  return {
    type: "box",
    name,
    styles: {
      base: {
        aspectRatio: ratio,
        width,
        borderRadius: radius("large"),
        backgroundColor: colour(tone),
      },
    },
  };
}

export function quote(words: string, citation: string): NodeBlueprint {
  return {
    type: "quote",
    props: { text: words, citation },
    styles: { base: { fontSize: "1.125rem", lineHeight: "1.5" } },
  };
}

export function list(items: string[]): NodeBlueprint {
  return { type: "list", props: { items, ordered: false } };
}

export function divider(): NodeBlueprint {
  return { type: "divider" };
}

export function link(label: string, href: string): NodeBlueprint {
  return { type: "link", props: { label, href, openInNewTab: false } };
}
