import type { Metadata } from "next";
import Link from "next/link";
import { LintelImage } from "../components/LintelImage";
import { LintelUnavailable, loadFromLintel } from "../components/LintelUnavailable";
import { PostCard } from "../components/PostCard";
import { RichText } from "../components/RichText";
import { getEntry, listEntries } from "../lib/lintel";
import { HOME_PAGE_SLUG, siteName } from "../lib/site";

// Rebuilt in the background at most once a minute (REVALIDATE_SECONDS in lib/lintel.ts).
// Next.js reads this when building, so it has to be a plain number.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const home = await getEntry("pages", HOME_PAGE_SLUG).catch(() => null);
  return { description: home?.data.summary ?? undefined };
}

/** The home page: your "home" page from Lintel if there is one, then the latest posts. */
export default async function HomePage() {
  const loaded = await loadFromLintel(() =>
    Promise.all([getEntry("pages", HOME_PAGE_SLUG), listEntries("posts", { perPage: 3 })]),
  );
  if (loaded.unreachable) return <LintelUnavailable error={loaded.unreachable} />;
  const [home, latestPosts] = loaded.result;

  return (
    <>
      <section className="hero">
        <h1>{home?.data.title ?? siteName}</h1>
        {home?.data.summary ? (
          <p className="lead">{home.data.summary}</p>
        ) : (
          !home && (
            <p className="lead">
              Add a page with the address <code>home</code> in Lintel to fill this space.
            </p>
          )
        )}
      </section>

      {home?.data.hero_image && (
        <LintelImage image={home.data.hero_image} aspectRatio={21 / 9} priority className="wide" />
      )}
      {home && <RichText value={home.data.body} />}

      {latestPosts && latestPosts.items.length > 0 && (
        <section aria-labelledby="latest-posts" className="section">
          <div className="section-heading">
            <h2 id="latest-posts">Latest posts</h2>
            <Link href="/blog">All posts &rarr;</Link>
          </div>
          <div className="post-grid">
            {latestPosts.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
