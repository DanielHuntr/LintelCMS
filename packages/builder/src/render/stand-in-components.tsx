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
import { MarkedText, withLineBreaks } from "./marked-text.js";
import { elementRenders } from "./elements/index.js";
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

const Picture = drawsProps(imageComponent, ({ props, attributes, mode }) => {
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
  if (!props.caption) return <img {...attributes} src={props.src} alt={props.alt} />;
  return (
    <figure {...attributes}>
      <img src={props.src} alt={props.alt} />
      <figcaption>{props.caption}</figcaption>
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

/** A row of links: its own, or one of the site's menus (top level only). */
const Navigation = drawsProps(navigationComponent, ({ props, attributes, node, mode }) => {
  const site = useSite();
  const links =
    props.menuSource === "site"
      ? menuOf(site, props.menuHandle).map((link) => ({
          label: link.label,
          href: link.url ?? "",
          isButton: link.style === "button",
        }))
      : props.links.map((link) => ({ ...link, isButton: false }));
  return (
    <nav {...attributes} aria-label={props.label || undefined}>
      {links.length === 0 && props.menuSource === "site" && mode === "canvas" ? (
        <EmptyMenuButton nodeId={node.id} />
      ) : (
        <ul>
          {links.map((link, index) => (
            <li key={index}>
              <a
                href={link.href || undefined}
                className={link.isButton ? "lintel-button" : undefined}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
});

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
