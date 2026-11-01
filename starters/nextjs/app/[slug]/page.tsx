import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LintelImage } from "../../components/LintelImage";
import { LintelUnavailable, loadFromLintel } from "../../components/LintelUnavailable";
import { RichText } from "../../components/RichText";
import { imageUrl } from "../../lib/images";
import { getEntry, listAllEntries } from "../../lib/lintel";
import { HOME_PAGE_SLUG } from "../../lib/site";

// Rebuilt in the background at most once a minute (REVALIDATE_SECONDS in lib/lintel.ts).
// Next.js reads this when building, so it has to be a plain number.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Pages published when the site is built are made then; pages published later are made the
 * first time someone visits. If Lintel isn't running during the build, every page is made
 * on its first visit instead.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const pages = await listAllEntries("pages");
    return pages
      .filter((page) => page.slug !== HOME_PAGE_SLUG)
      .map((page) => ({ slug: page.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getEntry("pages", slug).catch(() => null);
  if (!page) return {};
  const image = page.data.hero_image;
  return {
    title: page.data.title,
    description: page.data.summary ?? undefined,
    openGraph: image
      ? {
          images: [
            { url: imageUrl(image, { width: 1200, height: 630, format: "jpeg" }), alt: image.alt },
          ],
        }
      : undefined,
  };
}

export default async function LintelPage({ params }: PageProps) {
  const { slug } = await params;
  if (slug === HOME_PAGE_SLUG) permanentRedirect("/");

  const loaded = await loadFromLintel(() => getEntry("pages", slug));
  if (loaded.unreachable) return <LintelUnavailable error={loaded.unreachable} />;
  const page = loaded.result;
  if (!page) notFound();

  return (
    <article>
      <header className="hero">
        <h1>{page.data.title}</h1>
        {page.data.summary && <p className="lead">{page.data.summary}</p>}
      </header>
      {page.data.hero_image && (
        <LintelImage image={page.data.hero_image} aspectRatio={16 / 9} priority className="wide" />
      )}
      <RichText value={page.data.body} />
    </article>
  );
}
