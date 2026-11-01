import { classNames } from "../class-names.js";
import { Columns } from "../layout/Columns.js";
import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import { Pagination } from "../posts/Pagination.js";
import { PostCard, type PostCardLayout } from "../posts/PostCard.js";
import type { SiteLabels } from "../site.types.js";
import type { PostListView } from "./view.types.js";

export interface PostListLayoutProps {
  view: PostListView;
  locale: string;
  labels: SiteLabels;
  /** Cards in a grid, or rows in a reading list. */
  cardLayout: PostCardLayout;
}

/** The blog's index or an archive: a heading, the posts, and links to other pages of them. */
export function PostListLayout({ view, locale, labels, cardLayout }: PostListLayoutProps) {
  const cards = view.posts.map((post) => (
    <PostCard key={post.id} post={post} locale={locale} layout={cardLayout} />
  ));
  return (
    <Section component="post_list" className="lintel-post-list-section">
      <Container width={cardLayout === "row" ? "narrow" : "normal"}>
        <header className="lintel-list-header lintel-page-header">
          <h1 className="lintel-page-header__title">{view.title}</h1>
          {view.description && <p className="lintel-page-header__summary">{view.description}</p>}
        </header>
        {view.posts.length === 0 ? (
          <p className="lintel-message__text">{labels.noPostsYet}</p>
        ) : cardLayout === "card" ? (
          <Columns count={3} className="lintel-post-list">
            {cards}
          </Columns>
        ) : (
          <div className={classNames("lintel-post-list", "lintel-post-list--rows")}>{cards}</div>
        )}
        <Pagination links={view.pagination} labels={labels} />
      </Container>
    </Section>
  );
}
