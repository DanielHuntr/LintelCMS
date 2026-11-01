/**
 * The shapes of what Lintel's delivery API sends, and the fields of the two content types
 * every new Lintel site has: Pages and Blog posts. If you add fields in Lintel (Settings,
 * then Content types), add them here too, under the same handle.
 */

/** One published entry. `Data` holds its fields, keyed by handle. */
export interface DeliveredEntry<Data> {
  id: string;
  slug: string;
  /** Where the entry lives on the site, such as "/blog/hello-world". Null if it has no page. */
  url: string | null;
  /** When it was published, as an ISO date. */
  publishedAt: string | null;
  data: Data;
}

/** A page of entries from a collection, with the total for pagination. */
export interface DeliveredList<Data> {
  items: DeliveredEntry<Data>[];
  total: number;
}

/** An image field's value. `focalPoint` is where the subject is, from 0 to 1 across and down. */
export interface DeliveredImage {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  focalPoint: { x: number; y: number } | null;
}

/** A rich text field's value: the editor's document, and the HTML Lintel made from it. */
export interface RichText {
  json: unknown;
  html: string;
}

/** Empty fields are null, so every optional field can be. */
export interface PageData {
  title: string;
  summary: string | null;
  hero_image: DeliveredImage | null;
  body: RichText | null;
}

export interface PostData {
  title: string;
  excerpt: string | null;
  featured_image: DeliveredImage | null;
  body: RichText | null;
  category: "news" | "guides" | "updates" | null;
}

export type Page = DeliveredEntry<PageData>;
export type Post = DeliveredEntry<PostData>;
