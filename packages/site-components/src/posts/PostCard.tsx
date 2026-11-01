import { classNames } from "../class-names.js";
import { ResponsiveImage } from "../media/ResponsiveImage.js";
import type { PostSummary } from "./post.types.js";
import { PublishedDate } from "./PublishedDate.js";

export type PostCardLayout = "card" | "row";

export interface PostCardProps {
  post: PostSummary;
  locale: string;
  /** "card": picture above the words, for grids. "row": words first, for reading lists. */
  layout?: PostCardLayout;
}

/**
 * One post in a list. The whole card is one link (its title), so it is a single stop for
 * keyboard and screen reader users. Output: `<article class="lintel-post-card">`.
 */
export function PostCard({ post, locale, layout = "card" }: PostCardProps) {
  return (
    <article
      className={classNames("lintel-post-card", `lintel-post-card--${layout}`)}
      data-lintel-component="post_card"
    >
      {post.image && (
        <div className="lintel-post-card__media">
          <ResponsiveImage
            image={{ ...post.image, alt: "" }}
            aspectRatio={3 / 2}
            sizes={layout === "card" ? "(max-width: 40rem) 100vw, 24rem" : "12rem"}
            className="lintel-post-card__image"
          />
        </div>
      )}
      <div className="lintel-post-card__body">
        {post.publishedAt && <PublishedDate date={post.publishedAt} locale={locale} />}
        <h2 className="lintel-post-card__title">
          <a className="lintel-post-card__link" href={post.url}>
            {post.title}
          </a>
        </h2>
        {post.excerpt && <p className="lintel-post-card__excerpt">{post.excerpt}</p>}
      </div>
    </article>
  );
}
