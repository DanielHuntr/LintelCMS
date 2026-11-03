import type { NodeBlueprint } from "../components/component-definition.js";
import type {
  NodeAnimation,
  NodeStyles,
  StyleDeclarations,
} from "../document/page-document.schema.js";
import { space } from "../sections/section-parts.js";
import { menuDrawer, siteLogo, siteMenuRow } from "../sections/site-navigation.js";

/**
 * The small builders the restaurant, salon, planner, shop, studio and community starter
 * sites share: bands of the page on the site's own paper, the twelve-column grid, labels,
 * links, pictures, price lists and the navigation. Each site passes its own colours and
 * type, so the pieces are the same and the looks are not.
 */

export interface StarterLook {
  /** Colours, usually `light-dark(...)` pairs so they follow the visitor's setting. */
  paper: string;
  ink: string;
  /** Secondary text: AA on the paper in both modes. */
  quiet: string;
  /** Hairlines between rows. */
  rule: string;
  /** The small captions: dates, prices, labels. */
  detail: StyleDeclarations;
  /** The space either side of the page. */
  margin?: string;
  /** How round the buttons are ("0" for square, "999px" for a pill). */
  buttonCorners?: string;
}

export interface BandOptions {
  element?: string;
  /** Spacing steps above and below (8 by default, 9 at most). */
  top?: number;
  bottom?: number;
  /** How wide the content may be ("40rem"); the band's colour still runs edge to edge. */
  measure?: string;
  /** Background and text colours, when the band isn't on the paper. */
  colours?: { background: string; text: string };
  styles?: NodeStyles;
}

/** The address of one of the site's illustrations. */
export const picture = (illustration: string) => `/_lintel/illustrations/${illustration}.svg`;

/**
 * Where an element sits on the grid: columns `column` to `column + span - 1` of row `row`
 * (a number, or rows as CSS has them: "1 / span 3").
 */
export function at(
  column: number,
  span: number,
  row: number | string,
  extra: StyleDeclarations = {},
): NodeStyles {
  return { base: { gridColumn: `${column} / span ${span}`, gridRow: String(row), ...extra } };
}

/** A blueprint with more styles, screen size by screen size, over the ones it has. */
export function withStyles(blueprint: NodeBlueprint, styles: NodeStyles): NodeBlueprint {
  const own = blueprint.styles ?? { base: {} };
  const merged: NodeStyles = { ...own, ...styles, base: { ...own.base, ...styles.base } };
  for (const size of ["tablet", "phone", "hover"] as const) {
    if (own[size] || styles[size]) merged[size] = { ...own[size], ...styles[size] };
  }
  return { ...blueprint, styles: merged };
}

/** The same element with an animation. */
export function moving(blueprint: NodeBlueprint, animation: NodeAnimation): NodeBlueprint {
  return { ...blueprint, animation };
}

export interface PriceItem {
  name: string;
  price: string;
  detail?: string;
}

export function starterParts(look: StarterLook) {
  const margin = look.margin ?? "clamp(1.25rem, 4vw, 3.5rem)";

  /** A band across the page, with the same side margins everywhere. */
  function band(name: string, children: NodeBlueprint[], options: BandOptions = {}): NodeBlueprint {
    const top = options.top ?? 8;
    const bottom = options.bottom ?? 8;
    const side = options.measure ? `max(${margin}, calc((100% - ${options.measure}) / 2))` : margin;
    return {
      type: "section",
      name,
      props: { element: options.element ?? "section", anchor: "" },
      styles: {
        ...options.styles,
        base: {
          backgroundColor: options.colours?.background ?? look.paper,
          color: options.colours?.text ?? look.ink,
          paddingTop: space(Math.min(top, 9)),
          paddingBottom: space(Math.min(bottom, 9)),
          paddingLeft: side,
          paddingRight: side,
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
    name: string,
    children: NodeBlueprint[],
    options: BandOptions = {},
  ): NodeBlueprint {
    const own = band(name, children, options);
    return {
      ...withStyles(own, {
        base: {
          columnGap: "clamp(0.75rem, 1.8vw, 1.75rem)",
          rowGap: space(5),
          ...options.styles?.base,
        },
        phone: { rowGap: space(4), ...options.styles?.phone },
      }),
      placedGrid: { columns: 12, stackOnPhone: true },
    };
  }

  function words(
    name: string,
    text: string,
    styles: NodeStyles = { base: {} },
    animation?: NodeAnimation,
  ): NodeBlueprint {
    return {
      type: "text",
      name,
      props: { text },
      styles: withStyles({ type: "text" }, styles).styles ?? { base: {} },
      ...(animation ? { animation } : {}),
    };
  }

  function heading(
    name: string,
    text: string,
    level: number,
    styles: NodeStyles,
    animation?: NodeAnimation,
  ): NodeBlueprint {
    return withStyles(
      {
        type: "heading",
        name,
        props: { text, level },
        styles: { base: { color: "inherit", marginTop: "0", marginBottom: "0" } },
        ...(animation ? { animation } : {}),
      },
      styles,
    );
  }

  /** A small caption in the site's detail type. */
  function label(text: string, name = "Label", styles: NodeStyles = { base: {} }): NodeBlueprint {
    return words(
      name,
      text,
      withStyles({ type: "text", styles: { base: { ...look.detail, color: look.quiet } } }, styles)
        .styles,
    );
  }

  function link(
    name: string,
    text: string,
    href: string,
    styles: StyleDeclarations = {},
    hover: StyleDeclarations = { opacity: "0.65" },
  ): NodeBlueprint {
    return {
      type: "link",
      name,
      props: { label: text, href, openInNewTab: false },
      styles: { base: { color: "inherit", textDecoration: "none", ...styles }, hover },
    };
  }

  /** A button: a link styled as one, in the colours given. */
  function action(
    name: string,
    text: string,
    href: string,
    colours: { background: string; text: string },
    styles: StyleDeclarations = {},
  ): NodeBlueprint {
    return {
      type: "button",
      name,
      props: { label: text, href, openInNewTab: false },
      styles: {
        base: {
          display: "inline-block",
          backgroundColor: colours.background,
          color: colours.text,
          paddingTop: space(3),
          paddingBottom: space(3),
          paddingLeft: space(5),
          paddingRight: space(5),
          textDecoration: "none",
          textAlign: "center",
          width: "fit-content",
          borderRadius: look.buttonCorners ?? "0",
          ...styles,
        },
        hover: { opacity: "0.85" },
      },
    };
  }

  function image(
    name: string,
    illustration: string,
    alt: string,
    styles: NodeStyles = { base: {} },
    animation?: NodeAnimation,
  ): NodeBlueprint {
    return withStyles(
      {
        type: "image",
        name,
        props: { src: picture(illustration), alt, assetId: null, caption: "" },
        styles: { base: { width: "100%", height: "auto", borderRadius: "0" } },
        ...(animation ? { animation } : {}),
      },
      styles,
    );
  }

  /** A box that lays its children out in a row or a column. */
  function group(
    name: string,
    children: NodeBlueprint[],
    styles: NodeStyles = { base: {} },
    animation?: NodeAnimation,
  ): NodeBlueprint {
    return withStyles(
      {
        type: "box",
        name,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(3) } },
        children,
        ...(animation ? { animation } : {}),
      },
      styles,
    );
  }

  /** One line of a price list: the name and the price, with a line about it underneath. */
  function priceRow(item: PriceItem, nameStyles: StyleDeclarations = {}): NodeBlueprint {
    return {
      type: "box",
      name: "Item",
      styles: {
        base: {
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          columnGap: space(4),
          rowGap: space(1),
          alignItems: "baseline",
          paddingTop: space(4),
          paddingBottom: space(4),
          borderStyle: "solid",
          borderColor: look.rule,
          borderWidth: "0 0 1px 0",
        },
      },
      children: [
        words("Name", item.name, { base: { fontSize: "1.125rem", ...nameStyles } }),
        words("Price", item.price, { base: { textAlign: "right", fontSize: "1.0625rem" } }),
        ...(item.detail
          ? [
              words("About it", item.detail, {
                base: { gridColumn: "1 / span 2", color: look.quiet, fontSize: "0.9375rem" },
              }),
            ]
          : []),
      ],
    };
  }

  /** A titled list of prices, such as a course on a menu or a group of treatments. */
  function priceList(
    name: string,
    items: readonly PriceItem[],
    options: {
      styles?: NodeStyles;
      nameStyles?: StyleDeclarations;
      animation?: NodeAnimation;
    } = {},
  ): NodeBlueprint {
    return group(
      name,
      items.map((item) => priceRow(item, options.nameStyles)),
      withStyles({ type: "box", styles: { base: { gap: "0" } } }, options.styles ?? { base: {} })
        .styles,
      options.animation,
    );
  }

  /**
   * The site's navigation, on every page: its name on the left, the menu (Content → Menus)
   * and anything extra on the right; on phones the menu folds into a Menu button.
   */
  function navigation(options: {
    logo: StyleDeclarations;
    menu?: StyleDeclarations;
    extra?: NodeBlueprint[];
    styles?: StyleDeclarations;
  }): NodeBlueprint {
    return band(
      "Navigation",
      [
        siteLogo("name", { color: "inherit", minHeight: "0", ...options.logo }),
        group(
          "Menu and button",
          [
            siteMenuRow({ styles: { fontWeight: "400", color: look.ink, ...options.menu } }),
            ...(options.extra ?? []),
          ],
          {
            base: { flexDirection: "row", alignItems: "center", gap: space(5) },
            phone: { display: "none" },
          },
        ),
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
            justifyContent: "space-between",
            alignItems: "center",
            gap: space(5),
            ...options.styles,
          },
          phone: { paddingTop: space(3), paddingBottom: space(3) },
        },
      },
    );
  }

  /** A big number that counts up as it comes into view, with what it counts underneath. */
  function figure(
    number: string,
    counts: string,
    numberStyles: StyleDeclarations,
    styles: NodeStyles = { base: {} },
  ): NodeBlueprint {
    return group(
      "Number",
      [
        {
          ...words("Figure", number, { base: { lineHeight: "1", ...numberStyles } }),
          effects: [{ effect: "count-up", params: {} }],
        },
        words("What it counts", counts, { base: { maxWidth: "18rem", lineHeight: "1.4" } }),
      ],
      withStyles({ type: "box", styles: { base: { gap: space(2) } } }, styles).styles,
    );
  }

  /** Shows only once the site asks visitors about cookies. */
  function cookieSettings(styles: StyleDeclarations = {}): NodeBlueprint {
    return {
      type: "cookieSettings",
      styles: {
        base: { color: "inherit", textDecoration: "none", width: "fit-content", ...styles },
        hover: { opacity: "0.65" },
      },
    };
  }

  return {
    look,
    band,
    gridBand,
    words,
    heading,
    label,
    link,
    action,
    image,
    group,
    priceRow,
    priceList,
    navigation,
    figure,
    cookieSettings,
  };
}
