import { notFound } from "next/navigation";
import { LintelUnavailable, loadFromLintel } from "../../components/LintelUnavailable";
import { Pagination } from "../../components/Pagination";
import { PostCard } from "../../components/PostCard";
import type { PostData } from "../../lib/content-types";
import { listEntries } from "../../lib/lintel";
import { POSTS_PER_PAGE } from "../../lib/site";

/** One page of the blog, newest first. Shared by /blog and /blog/page/2... */
export async function BlogIndex({ page }: { page: number }) {
  const loaded = await loadFromLintel(() =>
    listEntries<PostData>("posts", { page, perPage: POSTS_PER_PAGE }),
  );
  if (loaded.unreachable) return <LintelUnavailable error={loaded.unreachable} />;
  const posts = loaded.result;
  // No blog (the Blog feature is off in Lintel), or a page past the last one.
  if (!posts || (page > 1 && posts.items.length === 0)) notFound();

  const pageCount = Math.max(1, Math.ceil(posts.total / POSTS_PER_PAGE));
  return (
    <>
      <header className="hero">
        <h1>Blog</h1>
      </header>
      {posts.items.length === 0 ? (
        <p className="lead">No posts yet. Publish one in Lintel and it appears here.</p>
      ) : (
        <div className="post-grid">
          {posts.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} />
    </>
  );
}
