import {
  callToActionBlockComponent,
  heroBlockComponent,
  imageBlockComponent,
  questionBlockComponent,
  textBlockComponent,
} from "@lintel/builder-model";
import {
  CallToAction,
  FaqList,
  Hero,
  ImageSection,
  type SiteImage,
  type SiteLink,
  TextSection,
} from "@lintel/site-components";
import { type ComponentRender, drawsProps } from "./component-registry.js";

/**
 * The site's ready-made blocks, drawn by `@lintel/site-components`, the same components the
 * published site uses. Each sits in one element that carries the builder's class (and, on
 * the canvas, its node id), so it can be selected, moved and styled as a whole; the block's
 * own markup and classes (`lintel-hero`...) are exactly the site's.
 */

function picture(src: string, alt: string): SiteImage | null {
  return src ? { url: src, alt, width: null, height: null, focalPoint: null } : null;
}

function link(label: string, href: string): SiteLink | null {
  return label && href ? { label, url: href } : null;
}

/** Plain text with empty lines between paragraphs, as the HTML the Text block expects. */
export function paragraphsHtml(text: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const HeroBlock = drawsProps(heroBlockComponent, ({ props, node, attributes }) => (
  <div {...attributes}>
    <Hero
      id={node.id}
      heading={props.heading}
      subheading={props.subheading}
      button={link(props.buttonLabel, props.buttonHref)}
      image={picture(props.src, props.alt)}
      headingLevel={props.isPageTitle ? 1 : 2}
    />
  </div>
));

const CallToActionBlock = drawsProps(callToActionBlockComponent, ({ props, node, attributes }) => (
  <div {...attributes}>
    <CallToAction
      id={node.id}
      heading={props.heading}
      text={props.text}
      button={link(props.buttonLabel, props.buttonHref)}
    />
  </div>
));

const TextBlock = drawsProps(textBlockComponent, ({ props, node, attributes }) => (
  <div {...attributes}>
    <TextSection id={node.id} heading={props.heading} body={paragraphsHtml(props.text)} />
  </div>
));

const ImageBlock = drawsProps(imageBlockComponent, ({ props, node, attributes, mode }) => {
  const image = picture(props.src, props.alt);
  if (!image) {
    return mode === "canvas" ? <div {...attributes} data-lintel-placeholder="image" /> : null;
  }
  return (
    <div {...attributes}>
      <ImageSection id={node.id} image={image} caption={props.caption} />
    </div>
  );
});

const QuestionBlock = drawsProps(questionBlockComponent, ({ props, node, attributes }) => (
  <div {...attributes}>
    <FaqList
      questions={[{ id: node.id, question: props.question, answer: paragraphsHtml(props.answer) }]}
    />
  </div>
));

export const siteBlockRenders: Readonly<Record<string, ComponentRender>> = {
  heroBlock: HeroBlock,
  callToActionBlock: CallToActionBlock,
  textBlock: TextBlock,
  imageBlock: ImageBlock,
  questionBlock: QuestionBlock,
};
