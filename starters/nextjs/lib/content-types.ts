/**
 * The shapes of what Lintel's delivery API sends for this site's content. They come from
 * `lintel.generated.ts`, which Lintel writes from your content model: after adding a field
 * or a content type, run `pnpm --filter @lintel/core model types --out
 * starters/nextjs/lib/lintel.generated.ts` (see the README) instead of editing types here.
 */
import type { DeliveredEntry, DeliveredRichText, PageData, PostData } from "./lintel.generated";

export type {
  CollectionData,
  CollectionHandle,
  DeliveredEntry,
  DeliveredImage,
  DeliveredList,
  DeliveredTerm,
  PageData,
  PostData,
} from "./lintel.generated";

/** A rich text field's value: the editor's document, and the HTML Lintel made from it. */
export type RichText = DeliveredRichText;

export type Page = DeliveredEntry<PageData>;
export type Post = DeliveredEntry<PostData>;
