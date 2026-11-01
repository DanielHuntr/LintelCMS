import type { Metadata } from "next";
import { BlogIndex } from "./BlogIndex";

// Rebuilt in the background at most once a minute (REVALIDATE_SECONDS in lib/lintel.ts).
// Next.js reads this when building, so it has to be a plain number.
export const revalidate = 60;

export const metadata: Metadata = { title: "Blog" };

export default function BlogPage() {
  return <BlogIndex page={1} />;
}
