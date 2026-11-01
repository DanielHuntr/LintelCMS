import Link from "next/link";
import type { Post } from "../lib/content-types";
import { formatDate } from "../lib/dates";
import { LintelImage } from "./LintelImage";

/** A post in a list: its image (square-ish, cropped around the subject), title and excerpt. */
export function PostCard({ post }: { post: Post }) {
  const href = post.url ?? `/blog/${post.slug}`;
  return (
    <article className="post-card">
      {post.data.featured_image && (
        <Link href={href} tabIndex={-1} aria-hidden="true" className="post-card-image">
          <LintelImage
            image={post.data.featured_image}
            aspectRatio={4 / 3}
            sizes="(min-width: 960px) 300px, (min-width: 640px) 45vw, 100vw"
          />
        </Link>
      )}
      <div className="post-card-text">
        {post.publishedAt && (
          <time dateTime={post.publishedAt} className="meta">
            {formatDate(post.publishedAt)}
          </time>
        )}
        <h3>
          <Link href={href}>{post.data.title}</Link>
        </h3>
        {post.data.excerpt && <p>{post.data.excerpt}</p>}
      </div>
    </article>
  );
}
