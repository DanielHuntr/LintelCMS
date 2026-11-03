import { FigureCaption } from "@lintel/site-components";
import {
  boxComponent,
  buttonComponent,
  codeBlockComponent,
  columnsComponent,
  containerComponent,
  dividerComponent,
  fillCodeMarkers,
  headingComponent,
  imageComponent,
  linkComponent,
  listComponent,
  makeScriptSafeToEmbed,
  menuItemKey,
  menuLinkOf,
  navigationComponent,
  pageComponent,
  quoteComponent,
  removeScriptsFromHtml,
  sectionComponent,
  standardComponents,
  textComponent,
} from "@lintel/builder-model";
import { type ComponentRender, createComponentRegistry, drawsProps } from "./component-registry.js";
import { CustomBlockElement } from "./custom-block.js";
import { usePageData } from "./data-context.js";
import { MarkedText, withLineBreaks } from "./marked-text.js";
import { elementRenders } from "./elements/index.js";
import { MenuLink, type MenuLinkEntry, MenuLinksContext } from "./elements/menu-link.js";
import { EmptyMenuButton, menuOf, useSite } from "./elements/navigation.js";
import { siteBlockRenders } from "./site-blocks.js";

/**
 * Simple drawings for the standard components, until `@lintel/site-components` provides the
 * real ones. Each prints clean, semantic HTML: headings, sections, lists, figures with alt
 * text, links. No inline styles: every look comes from the node's class in the stylesheet.
 */

function linkTarget(openInNewTab: boolean) {
  return openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

const Page = drawsProps(pageComponent, ({ attributes, children }) => (
  <div {...attributes}>{children}</div>
));

const Section = drawsProps(sectionComponent, ({ props, attributes, children }) => {
  // One of the section elements; typed as one so JSX accepts the union of tag names.
  const Element = props.element as "section";
  return (
    <Element {...attributes} id={props.anchor || undefined}>
      {children}
    </Element>
  );
});

const Container = drawsProps(containerComponent, ({ attributes, children }) => (
  <div {...attributes}>{children}</div>
));

const Box = drawsProps(boxComponent, ({ props, attributes, children }) => {
  const Element = props.element;
  return <Element {...attributes}>{children}</Element>;
});

const Columns = drawsProps(columnsComponent, ({ attributes, children }) => (
  <div {...attributes}>{children}</div>
));

const Divider = drawsProps(dividerComponent, ({ attributes }) => <hr {...attributes} />);

const Heading = drawsProps(headingComponent, ({ props, attributes, editableText, mode }) => {
  const Element = `h${props.level}` as "h1";
  return (
    <Element {...attributes} {...editableText("text")}>
      <MarkedText
        text={props.text}
        marks={props.marks}
        className={attributes.className}
        linksWork={mode === "site"}
      />
    </Element>
  );
});

const Text = drawsProps(textComponent, ({ props, attributes, editableText, mode }) => (
  <p {...attributes} {...editableText("text")}>
    <MarkedText
      text={props.text}
      marks={props.marks}
      className={attributes.className}
      linksWork={mode === "site"}
    />
  </p>
));

const Quote = drawsProps(quoteComponent, ({ props, attributes, editableText }) => (
  <figure {...attributes}>
    <blockquote>
      <p {...editableText("text")}>{withLineBreaks(props.text)}</p>
    </blockquote>
    {props.citation && <figcaption>{props.citation}</figcaption>}
  </figure>
));

const List = drawsProps(listComponent, ({ props, attributes }) => {
  const Element = props.ordered ? "ol" : "ul";
  return (
    <Element {...attributes}>
      {props.items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Element>
  );
});

/** A picture, with its caption and (when the licence asks for one) its credit underneath. */
const Picture = drawsProps(imageComponent, ({ props, attributes, mode }) => {
  const data = usePageData();
  if (!props.src) {
    return mode === "canvas" ? (
      <div
        {...attributes}
        data-lintel-placeholder="image"
        role="img"
        aria-label={props.alt || undefined}
      />
    ) : null;
  }
  const credit = props.showCredit && props.assetId ? data.credits?.[props.assetId] : undefined;
  if (!props.caption && !credit) return <img {...attributes} src={props.src} alt={props.alt} />;
  return (
    <figure {...attributes}>
      <img src={props.src} alt={props.alt} />
      <FigureCaption caption={props.caption} credit={credit} />
    </figure>
  );
});

const Button = drawsProps(buttonComponent, ({ props, attributes, editableText }) => (
  <a
    {...attributes}
    href={props.href || undefined}
    {...linkTarget(props.openInNewTab)}
    {...editableText("label")}
  >
    {props.label}
  </a>
));

const Link = drawsProps(linkComponent, ({ props, attributes, editableText }) => (
  <a
    {...attributes}
    href={props.href || undefined}
    {...linkTarget(props.openInNewTab)}
    {...editableText("label")}
  >
    {props.label}
  </a>
));

/**
 * A row of links: its own, or one of the site's menus (top level only). With a Menu link
 * inside (every Menu has one now), the Menu link draws the links in its look; menus made
 * before then draw them as they always did.
 */
const Navigation = drawsProps(
  navigationComponent,
  ({ props, attributes, node, mode, children }) => {
    const site = useSite();
    const links: MenuLinkEntry[] =
      props.menuSource === "site"
        ? menuOf(site, props.menuHandle).map((link, index) => ({
            id: menuItemKey(link.id, index),
            label: link.label,
            href: link.url ?? "",
            isButton: link.style === "button",
            current: link.current,
          }))
        : props.links.map((link, index) => ({
            ...link,
            id: menuItemKey(undefined, index),
            isButton: false,
            current: false,
          }));
    const drawnByMenuLink = menuLinkOf(node) !== undefined;
    return (
      <nav {...attributes} aria-label={props.label || undefined}>
        {links.length === 0 && props.menuSource === "site" && mode === "canvas" ? (
          <EmptyMenuButton nodeId={node.id} />
        ) : drawnByMenuLink ? (
          <ul>
            <MenuLinksContext value={links}>{children}</MenuLinksContext>
          </ul>
        ) : (
          <ul>
            {links.map((link, index) => (
              <li key={index}>
                <a
                  href={link.href || undefined}
                  className={link.isButton ? "lintel-button" : undefined}
                  aria-current={link.current ? "page" : undefined}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
    );
  },
);

/**
 * The block's own HTML with the marked parts filled in. On the canvas scripts are always
 * taken out (the canvas never runs page code); on the site the HTML is as saved, which the
 * server has already cleaned according to the site's rule for scripts.
 */
const CodeBlock = drawsProps(codeBlockComponent, ({ props, attributes, mode }) => {
  const filled = fillCodeMarkers(props.html, props.fields, props.images);
  const html = mode === "canvas" ? removeScriptsFromHtml(filled) : filled;
  return (
    <>
      <div {...attributes} dangerouslySetInnerHTML={{ __html: html }} />
      {mode === "site" && props.js.trim() !== "" && (
        <script dangerouslySetInnerHTML={{ __html: makeScriptSafeToEmbed(props.js) }} />
      )}
    </>
  );
});

export const standInRenders: Readonly<Record<string, ComponentRender>> = {
  page: Page,
  section: Section,
  container: Container,
  box: Box,
  columns: Columns,
  divider: Divider,
  heading: Heading,
  text: Text,
  quote: Quote,
  list: List,
  image: Picture,
  button: Button,
  link: Link,
  navigation: Navigation,
  menuLink: MenuLink,
  codeBlock: CodeBlock,
  customBlock: CustomBlockElement,
};

/**
 * Every standard component's drawing: the site's ready-made blocks from
 * `@lintel/site-components`, and the builder's own elements above.
 */
export const standardRenders: Readonly<Record<string, ComponentRender>> = {
  ...standInRenders,
  ...elementRenders,
  ...siteBlockRenders,
};

/** The standard components with their drawings: what the builder uses by default. */
export const standardRegistry = createComponentRegistry(standardComponents, standardRenders);
