import { BlockList } from "../blocks/BlockList.js";
import { RichText } from "../blocks/RichText.js";
import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import { ResponsiveImage } from "../media/ResponsiveImage.js";
import type { PageView } from "./view.types.js";

/**
 * A page: its title, summary and hero image, its body, then its sections. When the first
 * section is a hero, the hero is the top of the page and its heading is the page's `h1`,
 * so the title isn't shown twice.
 */
export function PageLayout({ view }: { view: PageView }) {
  const opensWithHero = view.sections[0]?.type === "hero";
  return (
    <>
      {!opensWithHero && (
        <Section component="page_header" className="lintel-page-header">
          <Container width="narrow">
            <h1 className="lintel-page-header__title" data-lintel-field="title">
              {view.title}
            </h1>
            {view.summary && (
              <p className="lintel-page-header__summary" data-lintel-field="summary">
                {view.summary}
              </p>
            )}
          </Container>
          {view.heroImage && (
            <Container width="wide" className="lintel-page-header__media">
              <ResponsiveImage
                image={view.heroImage}
                aspectRatio={16 / 9}
                phoneAspectRatio={4 / 3}
                sizes="(max-width: 80rem) 100vw, 80rem"
                priority
                className="lintel-hero__image"
                field="hero_image"
              />
            </Container>
          )}
        </Section>
      )}
      {view.body.trim() !== "" && (
        <Section component="body">
          <Container width="narrow">
            <RichText html={view.body} field="body" />
          </Container>
        </Section>
      )}
      <BlockList blocks={view.sections} heroIsTitle={opensWithHero} />
    </>
  );
}
