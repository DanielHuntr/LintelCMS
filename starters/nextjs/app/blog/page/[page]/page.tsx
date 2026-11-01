import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogIndex } from "../../BlogIndex";

// Rebuilt in the background at most once a minute (REVALIDATE_SECONDS in lib/lintel.ts).
// Next.js reads this when building, so it has to be a plain number.
export const revalidate = 60;

interface BlogPageProps {
  params: Promise<{ page: string }>;
}

// Later pages are made on their first visit, then refreshed like the rest.
export function generateStaticParams(): { page: string }[] {
  return [];
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { page } = await params;
  return { title: `Blog, page ${page}` };
}

export default async function BlogPageNumber({ params }: BlogPageProps) {
  const page = Number((await params).page);
  if (!Number.isInteger(page) || page < 1) notFound();
  if (page === 1) permanentRedirect("/blog");
  return <BlogIndex page={page} />;
}
