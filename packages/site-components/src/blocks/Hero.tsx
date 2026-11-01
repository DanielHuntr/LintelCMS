import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import { ResponsiveImage } from "../media/ResponsiveImage.js";
import type { HeroBlock } from "./block.types.js";
import { Button } from "./Button.js";

export interface HeroProps extends Omit<HeroBlock, "type"> {
  /** 1 when the hero opens the page and its heading is the page's title. */
  headingLevel?: 1 | 2;
}

/**
 * The big opening of a page: a heading, a line or two, a button, and a picture framed
 * below them. The picture is cropped around its focal point, wider on large screens and
 * taller on phones, and loads first because it is the first thing visitors see.
 */
export function Hero({ id, heading, subheading, image, button, headingLevel = 2 }: HeroProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const headingId = `hero-${id}`;
  return (
    <Section component="hero" labelledBy={headingId} className="lintel-hero">
      <Container>
        <div className="lintel-hero__content">
          <Heading id={headingId} className="lintel-hero__heading" data-lintel-field="heading">
            {heading}
          </Heading>
          {subheading && (
            <p className="lintel-hero__subheading" data-lintel-field="subheading">
              {subheading}
            </p>
          )}
          {button && (
            <div className="lintel-hero__actions">
              <Button link={button} field="button" />
            </div>
          )}
        </div>
      </Container>
      {image && (
        <Container width="wide">
          <div className="lintel-hero__media">
            <ResponsiveImage
              image={image}
              aspectRatio={16 / 9}
              phoneAspectRatio={4 / 5}
              sizes="(max-width: 80rem) 100vw, 80rem"
              priority={headingLevel === 1}
              className="lintel-hero__image"
              field="image"
            />
          </div>
        </Container>
      )}
    </Section>
  );
}
