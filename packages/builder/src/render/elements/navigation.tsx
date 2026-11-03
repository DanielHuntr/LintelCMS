import {
  backToTopComponent,
  cookieSettingsComponent,
  type DataMenuLink,
  type DataSite,
  languageSwitcherComponent,
  type LinkProp,
  type MegaMenuItem,
  menuItemKey,
  mobileMenuComponent,
  searchBoxComponent,
  siteFooterComponent,
  siteHeaderComponent,
  siteLogoComponent,
} from "@lintel/builder-model";
import type { ReactNode } from "react";
import { drawsProps, type RenderMode } from "../component-registry.js";
import { usePageData } from "../data-context.js";
import { cx } from "./behaviour-types.js";
import { SocialLinkList } from "./info.js";
import { SiteIcon } from "./media.js";

/**
 * The header, menus and footer. Big menus are `<details>` disclosures, so they open without
 * script; the elements script closes them on Escape and when another opens. The phone menu
 * is a `<dialog>` opened by the browser's own command button.
 */

/** Until the website passes its own, the canvas shows a short sample menu. */
export const sampleSite: DataSite = {
  siteName: "Your site",
  homeUrl: "/",
  logo: null,
  menu: [
    { id: "home", label: "Home", url: "/", current: true, children: [] },
    { id: "about", label: "About", url: "/about", current: false, children: [] },
    { id: "contact", label: "Contact", url: "/contact", current: false, children: [] },
  ],
  socialLinks: [],
  footerText: "",
  languages: [],
  locale: "en-GB",
  apiBase: "/_lintel/api",
};

export function useSite(): DataSite {
  return usePageData().site ?? sampleSite;
}

/** The links of the menu an element chose: the main menu unless another was picked. */
export function menuOf(site: DataSite, handle: string): readonly DataMenuLink[] {
  if (handle === "" || handle === "main") return site.menu;
  return site.menus?.[handle] ?? [];
}

/**
 * On the canvas, in place of a menu with nothing in it: a small button that opens the menu
 * editor beside the canvas (the frame reports clicks on `data-lintel-open-menu`).
 */
export function EmptyMenuButton({ nodeId }: { nodeId: string }) {
  return (
    <button type="button" className="lintel-empty-menu" data-lintel-open-menu={nodeId}>
      <SiteIcon name="plus" className="lintel-empty-menu__icon" />
      Add pages to your menu
    </button>
  );
}

interface MenuEntry {
  /** The menu item's id (see `menuItemKey`). */
  id: string;
  label: string;
  href: string;
  current: boolean;
  isButton: boolean;
  columns: { title: string; links: LinkProp[] }[];
  featured: { src: string; alt: string; title: string; href: string } | null;
}

function fromSiteMenu(menu: readonly DataMenuLink[]): MenuEntry[] {
  return menu.map((link, index) => {
    const hasGroups = link.children.some((child) => child.children.length > 0);
    const asLink = (child: DataMenuLink): LinkProp => ({
      label: child.label,
      href: child.url ?? "",
    });
    const columns = hasGroups
      ? link.children.map((child) => ({ title: child.label, links: child.children.map(asLink) }))
      : link.children.length > 0
        ? [{ title: "", links: link.children.map(asLink) }]
        : [];
    return {
      id: menuItemKey(link.id, index),
      label: link.label,
      href: link.url ?? "",
      current: link.current,
      isButton: link.style === "button" && link.children.length === 0,
      columns,
      featured: null,
    };
  });
}

function fromCustomMenu(items: readonly MegaMenuItem[]): MenuEntry[] {
  return items.map((item, index) => ({
    id: menuItemKey(undefined, index),
    label: item.label,
    href: item.href,
    current: false,
    isButton: false,
    columns: [
      { title: item.columnOneTitle, links: item.columnOneLinks },
      { title: item.columnTwoTitle, links: item.columnTwoLinks },
      { title: item.columnThreeTitle, links: item.columnThreeLinks },
    ].filter((column) => column.links.length > 0),
    featured:
      item.featuredImage.src || item.featuredTitle
        ? {
            src: item.featuredImage.src,
            alt: item.featuredImage.alt,
            title: item.featuredTitle,
            href: item.featuredHref,
          }
        : null,
  }));
}

function href(address: string, mode: RenderMode): string | undefined {
  return mode === "site" && address ? address : undefined;
}

function MegaMenu({
  entries,
  mode,
  idPrefix,
}: {
  entries: MenuEntry[];
  mode: RenderMode;
  idPrefix: string;
}) {
  return (
    <ul className="lintel-mega">
      {entries.map((entry, index) => {
        const hasPanel = entry.columns.length > 0 || entry.featured !== null;
        if (!hasPanel) {
          return (
            <li key={index} className="lintel-mega__item">
              <a
                className={cx(
                  "lintel-mega__link",
                  entry.isButton && "lintel-button lintel-mega__link--button",
                )}
                href={href(entry.href, mode)}
                aria-current={entry.current ? "page" : undefined}
              >
                {entry.label}
              </a>
            </li>
          );
        }
        return (
          <li key={index} className="lintel-mega__item">
            <details className="lintel-mega__disclosure" data-menu={`${idPrefix}-${index}`}>
              <summary className="lintel-mega__toggle">
                {entry.label}
                <SiteIcon name="chevron-down" className="lintel-mega__chevron" />
              </summary>
              <div className="lintel-mega__panel">
                {entry.href && (
                  <a className="lintel-mega__overview" href={href(entry.href, mode)}>
                    All of {entry.label}
                  </a>
                )}
                {entry.columns.map((column, columnIndex) => (
                  <div key={columnIndex} className="lintel-mega__column">
                    {column.title && <p className="lintel-mega__column-title">{column.title}</p>}
                    <ul>
                      {column.links.map((link, linkIndex) => (
                        <li key={linkIndex}>
                          <a href={href(link.href, mode)}>{link.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {entry.featured && (
                  <a className="lintel-mega__featured" href={href(entry.featured.href, mode)}>
                    {entry.featured.src && (
                      <img src={entry.featured.src} alt={entry.featured.alt} loading="lazy" />
                    )}
                    {entry.featured.title && <span>{entry.featured.title}</span>}
                  </a>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** A side panel of links, opened by a menu button. */
function Drawer({
  id,
  buttonLabel,
  side,
  links,
  mode,
  buttonClassName,
  children,
}: {
  id: string;
  buttonLabel: string;
  side: string;
  links: {
    id: string;
    label: string;
    href: string;
    current?: boolean;
    children?: { label: string; href: string }[];
  }[];
  mode: RenderMode;
  buttonClassName: string;
  children?: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        {...({ command: "show-modal", commandfor: id } as Record<string, string>)}
        aria-haspopup="dialog"
      >
        <SiteIcon name="text" className="lintel-drawer__icon" />
        <span>{buttonLabel}</span>
      </button>
      {mode === "site" && (
        <dialog
          id={id}
          className={cx("lintel-drawer", `lintel-drawer--${side}`)}
          aria-label={buttonLabel}
        >
          <form method="dialog" className="lintel-drawer__close-form">
            <button type="submit" className="lintel-drawer__close" aria-label="Close the menu">
              <SiteIcon name="x" />
            </button>
          </form>
          <nav aria-label={buttonLabel}>
            <ul className="lintel-drawer__links">
              {links.map((link, index) => (
                <li key={index}>
                  <a
                    href={href(link.href, mode)}
                    aria-current={link.current ? "page" : undefined}
                    data-menu-item={link.id}
                  >
                    {link.label}
                  </a>
                  {link.children && link.children.length > 0 && (
                    <ul>
                      {link.children.map((child, childIndex) => (
                        <li key={childIndex}>
                          <a href={href(child.href, mode)}>{child.label}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          {children}
        </dialog>
      )}
    </>
  );
}

function drawerLinks(entries: MenuEntry[]) {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    href: entry.href,
    current: entry.current,
    children: entry.columns.flatMap((column) =>
      column.links.map((link) => ({ label: link.label, href: link.href })),
    ),
  }));
}

const SiteHeader = drawsProps(siteHeaderComponent, ({ props, attributes, node, mode }) => {
  const site = useSite();
  const entries =
    props.menuSource === "site"
      ? fromSiteMenu(menuOf(site, props.menuHandle))
      : fromCustomMenu(props.items);
  const showsEmptyMenu = props.menuSource === "site" && entries.length === 0 && mode === "canvas";
  const logo = props.logo.src
    ? props.logo
    : site.logo
      ? { src: site.logo.src, alt: site.logo.alt }
      : null;
  return (
    <header
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-site-header",
        props.sticks && "lintel-site-header--sticky",
      )}
      data-behaviour="site-header"
    >
      <a className="lintel-site-header__brand" href={href(site.homeUrl, mode)}>
        {logo && (
          <img
            className="lintel-site-header__logo"
            src={logo.src}
            alt={props.showSiteName ? "" : logo.alt || site.siteName}
          />
        )}
        {(props.showSiteName || !logo) && (
          <span className="lintel-site-header__name">{site.siteName}</span>
        )}
      </a>
      {showsEmptyMenu ? (
        // Shown at every width, in place of both the menu and the phone's menu button.
        <div className="lintel-site-header__empty-menu">
          <EmptyMenuButton nodeId={node.id} />
        </div>
      ) : (
        <nav className="lintel-site-header__nav" aria-label="Main">
          <MegaMenu entries={entries} mode={mode} idPrefix={node.id} />
        </nav>
      )}
      {props.buttonLabel && (
        <a className="lintel-button lintel-site-header__button" href={href(props.buttonHref, mode)}>
          {props.buttonLabel}
        </a>
      )}
      {!showsEmptyMenu && (
        <Drawer
          id={`drawer-${node.id}`}
          buttonLabel="Menu"
          side="right"
          links={drawerLinks(entries)}
          mode={mode}
          buttonClassName="lintel-site-header__menu-button lintel-drawer__open"
        />
      )}
    </header>
  );
});

/** The site's logo and name, linking home. Without a logo, the name shows whatever is chosen. */
const SiteLogo = drawsProps(siteLogoComponent, ({ props, attributes, mode }) => {
  const site = useSite();
  const logo = props.shows !== "name" ? site.logo : null;
  const showsName = props.shows !== "logo" || !logo;
  return (
    <a
      {...attributes}
      className={cx(attributes.className, "lintel-site-logo")}
      href={href(site.homeUrl, mode)}
      aria-label={showsName ? undefined : site.siteName}
    >
      {logo && (
        <img
          className="lintel-site-logo__image"
          src={logo.src}
          alt=""
          width={logo.width ?? undefined}
          height={logo.height ?? undefined}
        />
      )}
      {showsName && <span className="lintel-site-logo__name">{site.siteName}</span>}
    </a>
  );
});

const MobileMenu = drawsProps(mobileMenuComponent, ({ props, attributes, node, mode }) => {
  const site = useSite();
  const links =
    props.menuSource === "site"
      ? drawerLinks(fromSiteMenu(menuOf(site, props.menuHandle)))
      : props.links.map((link, index) => ({
          id: menuItemKey(undefined, index),
          label: link.label,
          href: link.href,
        }));
  if (props.menuSource === "site" && links.length === 0 && mode === "canvas") {
    return (
      <div {...attributes} className={cx(attributes.className, "lintel-mobile-menu")}>
        <EmptyMenuButton nodeId={node.id} />
      </div>
    );
  }
  return (
    <div
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-mobile-menu",
        props.onlyOnSmallScreens && "lintel-mobile-menu--small-screens",
      )}
    >
      <Drawer
        id={`drawer-${node.id}`}
        buttonLabel={props.buttonLabel}
        side={props.side}
        links={links}
        mode={mode}
        buttonClassName="lintel-drawer__open lintel-button lintel-button--secondary"
      />
    </div>
  );
});

const SiteFooter = drawsProps(siteFooterComponent, ({ props, attributes, mode }) => {
  const site = useSite();
  const year = new Date().getFullYear();
  const socialLinks = site.socialLinks.map((address) => ({
    network: networkOf(address),
    href: address,
  }));
  const otherLanguages = site.languages.filter((language) => !language.current);
  return (
    <footer {...attributes} className={cx(attributes.className, "lintel-site-footer")}>
      {props.columns.length > 0 && (
        <div className="lintel-site-footer__columns">
          {props.columns.map((column, index) => (
            <nav
              key={index}
              className="lintel-site-footer__column"
              aria-label={column.title || undefined}
            >
              {column.title && <p className="lintel-site-footer__title">{column.title}</p>}
              <ul>
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a href={href(link.href, mode)}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      )}
      <div className="lintel-site-footer__bottom">
        <p className="lintel-site-footer__small-print">
          {props.smallPrint || `© ${year} ${site.siteName}`}
          {site.cookieNotice && (
            <>
              {" "}
              <button
                type="button"
                className="lintel-cookie-settings"
                data-lintel-cookie-settings=""
              >
                Cookie settings
              </button>
            </>
          )}
        </p>
        {props.showLanguages && otherLanguages.length > 0 && (
          <ul className="lintel-language-links" aria-label="Languages">
            {otherLanguages.map((language) => (
              <li key={language.code}>
                <a href={href(language.url, mode)} hrefLang={language.code} lang={language.code}>
                  {language.name}
                </a>
              </li>
            ))}
          </ul>
        )}
        {props.showSocialLinks && socialLinks.length > 0 && (
          <SocialLinkList links={socialLinks} size="small" mode={mode} />
        )}
      </div>
    </footer>
  );
});

/** Which network a social address is for, from its host. */
export function networkOf(address: string): string {
  const host = /^https?:\/\/(?:www\.)?([^/]+)/i.exec(address)?.[1]?.toLowerCase() ?? "";
  if (address.startsWith("mailto:")) return "email";
  const known: Record<string, string> = {
    "instagram.com": "instagram",
    "facebook.com": "facebook",
    "x.com": "x",
    "twitter.com": "x",
    "linkedin.com": "linkedin",
    "youtube.com": "youtube",
    "tiktok.com": "tiktok",
    "pinterest.com": "pinterest",
    "github.com": "github",
    "bsky.app": "bluesky",
    "threads.net": "threads",
    "wa.me": "whatsapp",
  };
  return known[host] ?? "website";
}

const LanguageSwitcher = drawsProps(
  languageSwitcherComponent,
  ({ props, attributes, node, mode }) => {
    const site = useSite();
    // On the website, a site in one language has nothing to switch to.
    if (mode === "site" && site.languages.length <= 1) return null;
    const languages =
      site.languages.length > 0
        ? site.languages
        : [{ code: site.locale, name: "English", url: "/", current: true }];
    if (props.look === "menu") {
      return (
        <form
          {...attributes}
          className={cx(attributes.className, "lintel-language-switcher")}
          data-behaviour="language-menu"
          action="/"
        >
          <label className="lintel-visually-hidden" htmlFor={`language-${node.id}`}>
            {props.label}
          </label>
          <select
            id={`language-${node.id}`}
            name="language"
            defaultValue={languages.find((language) => language.current)?.url}
          >
            {languages.map((language) => (
              <option key={language.code} value={language.url} lang={language.code}>
                {language.name}
              </option>
            ))}
          </select>
          <noscript>
            <button type="submit">Go</button>
          </noscript>
        </form>
      );
    }
    return (
      <nav
        {...attributes}
        className={cx(attributes.className, "lintel-language-switcher")}
        aria-label={props.label}
      >
        <ul className="lintel-language-links">
          {languages.map((language) => (
            <li key={language.code}>
              <a
                href={href(language.url, mode)}
                hrefLang={language.code}
                lang={language.code}
                aria-current={language.current ? "true" : undefined}
              >
                {language.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  },
);

const SearchBox = drawsProps(searchBoxComponent, ({ props, attributes, node }) => (
  <div {...attributes} className={cx(attributes.className, "lintel-search-box")}>
    <form action="/search" method="get" role="search">
      <label htmlFor={`search-${node.id}`} className="lintel-search-box__label">
        {props.label}
      </label>
      <span className="lintel-search-box__row">
        <input
          id={`search-${node.id}`}
          type="search"
          name="q"
          placeholder={props.placeholder}
          autoComplete="off"
        />
        <button type="submit" className="lintel-button">
          <SiteIcon name="search" className="lintel-search-box__icon" />
          <span>{props.buttonLabel}</span>
        </button>
      </span>
    </form>
  </div>
));

const BackToTop = drawsProps(backToTopComponent, ({ props, attributes, editableText }) => (
  <a
    {...attributes}
    href="#top"
    className={cx(
      attributes.className,
      "lintel-back-to-top",
      props.floats && "lintel-back-to-top--floats",
    )}
    data-behaviour="back-to-top"
  >
    <SiteIcon name="arrow-up" />
    <span {...editableText("label")}>{props.label}</span>
  </a>
));

/**
 * "Cookie settings": a button the cookie notice's script listens for, to open the notice
 * again. On the website it shows only on a site that has the notice; the canvas always shows it.
 */
const CookieSettings = drawsProps(
  cookieSettingsComponent,
  ({ props, attributes, editableText, mode }) => {
    const site = useSite();
    if (mode === "site" && !site.cookieNotice) return null;
    return (
      <button
        {...attributes}
        type="button"
        className={cx(attributes.className, "lintel-cookie-settings")}
        data-lintel-cookie-settings=""
      >
        <span {...editableText("label")}>{props.label}</span>
      </button>
    );
  },
);

export const navigationRenders = {
  siteHeader: SiteHeader,
  siteLogo: SiteLogo,
  mobileMenu: MobileMenu,
  siteFooter: SiteFooter,
  languageSwitcher: LanguageSwitcher,
  searchBox: SearchBox,
  backToTop: BackToTop,
  cookieSettings: CookieSettings,
};
