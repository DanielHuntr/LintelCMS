import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { button, colour, space, text } from "./section-parts.js";

/**
 * The navigation and footer sections people add once for the whole site (see
 * site-sections/). Their links follow one of the site's menus (Content → Menus, the main
 * menu to start with), so a page added to the menu shows in every one of them. On phones the
 * menu folds into a Menu button that opens a drawer. Colours, fonts and corners
 * are the theme's, so each follows the site's look, light or dark.
 */

/** The site's logo and name, linking home. */
export function siteLogo(shows: "both" | "logo" | "name" = "both", styles?: StyleDeclarations) {
  return {
    type: "siteLogo",
    props: { shows },
    ...(styles ? { styles: { base: styles } } : {}),
  } satisfies NodeBlueprint;
}

/** One of the site's menus as a row of links; folded away on phones unless `always`. */
export function siteMenuRow(
  options: {
    menuHandle?: string;
    label?: string;
    always?: boolean;
    styles?: StyleDeclarations;
  } = {},
): NodeBlueprint {
  return {
    type: "navigation",
    name: "Menu",
    props: {
      menuSource: "site",
      menuHandle: options.menuHandle ?? "main",
      label: options.label ?? "Main",
      links: [],
    },
    styles: {
      base: { fontWeight: "500", ...options.styles },
      ...(options.always ? {} : { phone: { display: "none" } }),
    },
  };
}

/**
 * The Menu button that opens the site's menu in a drawer: on phones (where the row of links
 * is folded away), or always.
 */
export function menuDrawer(options: { always?: boolean } = {}): NodeBlueprint {
  return {
    type: "mobileMenu",
    name: "Menu button",
    props: {
      menuSource: "site",
      menuHandle: "main",
      links: [],
      buttonLabel: "Menu",
      side: "right",
      onlyOnSmallScreens: false,
    },
    ...(options.always
      ? {}
      : { styles: { base: { display: "none" }, phone: { display: "block" } } }),
  };
}

/** A row across the page: its first item on the left, the rest pushed along to the right. */
function row(
  name: string,
  children: NodeBlueprint[],
  styles: StyleDeclarations = {},
  tablet: StyleDeclarations = {},
): NodeBlueprint {
  return {
    type: "container",
    name,
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: space(5),
        maxWidth: "72rem",
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
        ...styles,
      },
      ...(Object.keys(tablet).length > 0 ? { tablet } : {}),
    },
    children,
  };
}

/** The band the navigation sits in. */
function navigationBand(children: NodeBlueprint[], styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "section",
    name: "Navigation",
    props: { element: "header", anchor: "" },
    styles: {
      base: {
        paddingTop: space(3),
        paddingBottom: space(3),
        paddingLeft: space(5),
        paddingRight: space(5),
        backgroundColor: colour("background"),
        boxShadow: `inset 0 -1px 0 ${colour("border")}`,
        ...styles,
      },
    },
    children,
  };
}

/** Logo on the left, the menu on the right. */
export function navigationLogoLeft(): NodeBlueprint {
  return navigationBand([row("Navigation row", [siteLogo(), siteMenuRow(), menuDrawer()])]);
}

/** The logo centred, with the menu centred underneath it. */
export function navigationCentred(): NodeBlueprint {
  return navigationBand(
    [
      {
        type: "container",
        name: "Navigation row",
        styles: {
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: space(3),
            maxWidth: "72rem",
            marginLeft: "auto",
            marginRight: "auto",
            width: "100%",
          },
          phone: { flexDirection: "row", justifyContent: "space-between" },
        },
        children: [siteLogo("both", { fontSize: "1.5rem" }), siteMenuRow(), menuDrawer()],
      },
    ],
    { paddingTop: space(5), paddingBottom: space(4) },
  );
}

/** Logo, menu and a button that stands out, staying at the top while visitors scroll. */
export function navigationWithButton(copy: { label: string; href: string }): NodeBlueprint {
  return navigationBand(
    [
      row("Navigation row", [
        siteLogo(),
        siteMenuRow({ styles: { marginLeft: "auto" } }),
        {
          ...button(copy.label, copy.href, "solid"),
          styles: {
            base: {
              display: "inline-block",
              paddingTop: space(2),
              paddingBottom: space(2),
              paddingLeft: space(4),
              paddingRight: space(4),
              borderRadius: "var(--lintel-radius-button)",
              fontWeight: "600",
              textDecoration: "none",
              backgroundColor: colour("brand"),
              color: colour("on-brand"),
            },
            hover: { opacity: "0.88" },
            phone: { display: "none" },
          },
        },
        menuDrawer(),
      ]),
    ],
    { position: "sticky", top: "0", zIndex: "20" },
  );
}

/** See-through, over the top of the page's first section: for a page that opens with a picture. */
export function navigationOverlay(): NodeBlueprint {
  return navigationBand([row("Navigation row", [siteLogo(), siteMenuRow(), menuDrawer()])], {
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "20",
    backgroundColor: "transparent",
    boxShadow: "none",
    paddingTop: space(4),
    paddingBottom: space(4),
  });
}

/** Just the logo and a Menu button, on every screen: quiet, for portfolios and small sites. */
export function navigationMinimal(): NodeBlueprint {
  return navigationBand([row("Navigation row", [siteLogo(), menuDrawer({ always: true })])], {
    boxShadow: "none",
    paddingTop: space(4),
    paddingBottom: space(4),
  });
}

/** The band a footer sits in, on the page's background with a line above, or dark. */
function footerBand(
  children: NodeBlueprint[],
  tone: "page" | "panel" | "dark",
  styles: StyleDeclarations = {},
): NodeBlueprint {
  const tones: Record<typeof tone, StyleDeclarations> = {
    page: { boxShadow: `inset 0 1px 0 ${colour("border")}` },
    panel: { backgroundColor: colour("surface") },
    dark: { backgroundColor: colour("text"), color: colour("background") },
  };
  return {
    type: "section",
    name: "Footer",
    props: { element: "footer", anchor: "" },
    styles: {
      base: {
        paddingTop: space(7),
        paddingBottom: space(7),
        paddingLeft: space(5),
        paddingRight: space(5),
        ...tones[tone],
        ...styles,
      },
      phone: { paddingTop: space(6), paddingBottom: space(6) },
    },
    children,
  };
}

const smallPrintStyles: StyleDeclarations = { fontSize: "0.875rem", opacity: "0.75" };

/** "Cookie settings", beside the small print: it shows only on a site that asks about cookies. */
const cookieSettingsLink: NodeBlueprint = {
  type: "cookieSettings",
  styles: { base: smallPrintStyles },
};

/** Logo, the menu and a line of small print, all centred. */
export function footerCentred(copy: { smallPrint: string }): NodeBlueprint {
  return footerBand(
    [
      {
        type: "container",
        name: "Footer content",
        styles: {
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: space(4),
            maxWidth: "72rem",
            marginLeft: "auto",
            marginRight: "auto",
            width: "100%",
          },
        },
        children: [
          siteLogo(),
          siteMenuRow({ label: "Footer", always: true }),
          // Shows only on a site in more than one language.
          { type: "languageSwitcher", props: { look: "links", label: "Language" } },
          text(copy.smallPrint, { name: "Small print", styles: { base: smallPrintStyles } }),
          cookieSettingsLink,
        ],
      },
    ],
    "panel",
  );
}

/** Logo and small print on the left, the menu on the right, on one line. */
export function footerOneLine(copy: { smallPrint: string }): NodeBlueprint {
  return footerBand(
    [
      row(
        "Footer row",
        [
          {
            type: "box",
            name: "About",
            styles: { base: { display: "flex", flexDirection: "column", gap: space(1) } },
            children: [
              siteLogo("both", { fontSize: "1.125rem" }),
              text(copy.smallPrint, { name: "Small print", styles: { base: smallPrintStyles } }),
              cookieSettingsLink,
            ],
          },
          siteMenuRow({ label: "Footer", always: true }),
        ],
        { alignItems: "flex-end" },
        { flexDirection: "column", alignItems: "flex-start" },
      ),
    ],
    "page",
    { paddingTop: space(6), paddingBottom: space(6) },
  );
}

/** The site's name, big, over the menu and small print: a confident end to every page. */
export function footerBigName(copy: { smallPrint: string }): NodeBlueprint {
  return footerBand(
    [
      {
        type: "container",
        name: "Footer content",
        styles: {
          base: {
            display: "flex",
            flexDirection: "column",
            gap: space(6),
            maxWidth: "72rem",
            marginLeft: "auto",
            marginRight: "auto",
            width: "100%",
          },
        },
        children: [
          siteLogo("name", {
            fontSize: "clamp(2.5rem, 8vw, 5.5rem)",
            lineHeight: "1",
            letterSpacing: "-0.03em",
          }),
          row(
            "Footer row",
            [
              {
                type: "box",
                name: "Small print",
                styles: { base: { display: "flex", flexWrap: "wrap", gap: space(4) } },
                children: [
                  text(copy.smallPrint, { styles: { base: smallPrintStyles } }),
                  cookieSettingsLink,
                ],
              },
              siteMenuRow({ label: "Footer", always: true }),
            ],
            {},
            { flexDirection: "column", alignItems: "flex-start" },
          ),
        ],
      },
    ],
    "dark",
    { paddingTop: space(8) },
  );
}
