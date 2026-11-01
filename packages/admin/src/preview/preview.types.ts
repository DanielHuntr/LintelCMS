/** Live preview, as the API sends it (see core's src/preview and src/delivery). */

/** `POST /entries/:id/preview` */
export interface EntryPreview {
  token: string;
  expiresAt: string;
  /** The website's preview address with the token filled in; null when no site is connected. */
  previewUrl: string | null;
}

/** An entry as the delivery API serves it: images and rich text expanded. */
export interface DeliveredEntry {
  id: string;
  slug: string;
  url: string | null;
  publishedAt: string | null;
  data: Record<string, unknown>;
}

/** `GET /preview?token=` */
export interface PreviewedEntry {
  collection: string;
  entry: DeliveredEntry;
}

export interface DeliveredImage {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface DeliveredRichText {
  json: unknown;
  html: string;
}

export interface DeliveredBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}
