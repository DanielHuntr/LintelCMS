import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LintelImage } from "../../../components/LintelImage";
import { LintelUnavailable, loadFromLintel } from "../../../components/LintelUnavailable";
import { RichText } from "../../../components/RichText";
import type { PostData } from "../../../lib/content-types";
import { formatDate } from "../../../lib/dates";
import { imageUrl } from "../../../lib/images";
import { getEntry, listEntries } from "../../../lib/lintel";

// Rebuilt in the background at most once a minute (REVALIDATE_SECONDS in lib/lintel.ts).
// Next.js reads this when building, so it has to be a plain number.
export const revalidate = 60;

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

const categoryNames: Record<NonNullable<PostData["category"]>, string> = {
  news: "News",
  guides: "Guides",
  updates: "Updates",
};

/** The newest posts are made when the site is built; older ones on their first visit. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const posts = await listEntries<PostData>("posts", { perPage: 50 });
    return (posts?.items ?? []).map((post) => ({ slug: post.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getEntry<PostData>("posts", slug).catch(() => null);
  if (!post) return {};
  const image = post.data.featured_image;
  return {
    title: post.data.title,
    description: post.data.excerpt ?? undefined,
    openGraph: {
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      images: image
        ? [{ url: imageUrl(image, { width: 1200, height: 630, format: "jpeg" }), alt: image.alt }]
        : undefined,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const loaded = await loadFromLintel(() => getEntry<PostData>("posts", slug));
  if (loaded.unreachable) return <LintelUnavailable error={loaded.unreachable} />;
  const post = loaded.result;
  if (!post) notFound();

  return (
    <article>
      <header className="hero">
        <p className="meta">
          <Link href="/blog">Blog</Link>
          {post.data.category && <> · {categoryNames[post.data.category]}</>}
          {post.publishedAt && (
            <>
              {" · "}
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </>
          )}
        </p>
        <h1>{post.data.title}</h1>
        {post.data.excerpt && <p className="lead">{post.data.excerpt}</p>}
      </header>
      {post.data.featured_image && (
        <LintelImage
          image={post.data.featured_image}
          aspectRatio={16 / 9}
          priority
          className="wide"
        />
      )}
      <RichText value={post.data.body} />
    </article>
  );
}
