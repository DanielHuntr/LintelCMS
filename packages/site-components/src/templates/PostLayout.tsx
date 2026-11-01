import { RichText } from "../blocks/RichText.js";
import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import { ResponsiveImage } from "../media/ResponsiveImage.js";
import { PublishedDate } from "../posts/PublishedDate.js";
import { TermLinks } from "../posts/TermLinks.js";
import type { SiteLabels } from "../site.types.js";
import type { PostView } from "./view.types.js";

export interface PostLayoutProps {
  view: PostView;
  locale: string;
  labels: Pick<SiteLabels, "categories" | "tags">;
}

/** A blog post as an `<article>`: date, title and excerpt, picture, body, then its terms. */
export function PostLayout({ view, locale, labels }: PostLayoutProps) {
  return (
    <article className="lintel-post" data-lintel-component="post">
      <Section component="post_header" className="lintel-post__header">
        <Container width="narrow">
          {view.publishedAt && <PublishedDate date={view.publishedAt} locale={locale} />}
          <h1 className="lintel-post__title" data-lintel-field="title">
            {view.title}
          </h1>
          {view.excerpt && (
            <p className="lintel-post__excerpt" data-lintel-field="excerpt">
              {view.excerpt}
            </p>
          )}
        </Container>
        {view.image && (
          <Container width="wide" className="lintel-post__media">
            <ResponsiveImage
              image={view.image}
              aspectRatio={16 / 9}
              phoneAspectRatio={4 / 3}
              sizes="(max-width: 80rem) 100vw, 80rem"
              priority
              className="lintel-post__image"
              field="featured_image"
            />
          </Container>
        )}
      </Section>
      <Section component="post_body">
        <Container width="narrow">
          <RichText html={view.body} field="body" />
          {(view.categories.length > 0 || view.tags.length > 0 || view.backLink) && (
            <footer className="lintel-post__footer">
              <TermLinks label={labels.categories} terms={view.categories} />
              <TermLinks label={labels.tags} terms={view.tags} />
              {view.backLink && (
                <a className="lintel-post__back" href={view.backLink.url}>
                  ← {view.backLink.label}
                </a>
              )}
            </footer>
          )}
        </Container>
      </Section>
    </article>
  );
}
