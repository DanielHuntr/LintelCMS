import { photoCreditSchema, type PhotoCredit } from "../media/index.js";
import type {
  PageView,
  PostSummary,
  PostView,
  SiteBlock,
  SiteImage,
  SiteLink,
  TermLink,
} from "@lintel/site-components";
import type { DeliveredEntry } from "../delivery/delivery.schema.js";
import type { CustomScriptRule } from "@lintel/builder-model";
import { readPageDesign } from "./designed-pages.js";

/**
 * Turns entries as the delivery API serves them into the plain props the site components
 * take. Delivered data is untyped, and a draft may hold anything a blueprint once allowed,
 * so every value is read carefully and anything unexpected counts as empty.
 *
 * Field handles are the ones new sites start with (see src/collections), with a few
 * sensible alternatives, so content types made by hand still show something useful.
 */

type Data = Readonly<Record<string, unknown>>;

export function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Rich text and Markdown both arrive with their finished, safe HTML. */
export function readHtml(value: unknown): string {
  if (typeof value === "object" && value !== null && "html" in value) {
    return readText((value as { html: unknown }).html);
  }
  return "";
}

export function readImage(value: unknown): SiteImage | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const image = value as Record<string, unknown>;
  if (typeof image.url !== "string") {
    return null;
  }
  const focal = image.focalPoint as { x?: unknown; y?: unknown } | null | undefined;
  return {
    url: image.url,
    alt: readText(image.alt),
    width: typeof image.width === "number" ? image.width : null,
    height: typeof image.height === "number" ? image.height : null,
    focalPoint:
      focal && typeof focal.x === "number" && typeof focal.y === "number"
        ? { x: focal.x, y: focal.y }
        : null,
    credit: readCredit(image.credit),
  };
}

/** A delivered image's credit (see media/photo-credit.ts), checked; null for none. */
function readCredit(value: unknown): PhotoCredit | null {
  const parsed = photoCreditSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readLink(value: unknown): SiteLink | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const link = value as Record<string, unknown>;
  const url = readText(link.url).trim();
  if (url === "") {
    return null;
  }
  return { url, label: readText(link.label) || url, newTab: link.newTab === true };
}

/** The first of these fields that has a value. */
function firstOf<Value>(data: Data, handles: readonly string[], read: (value: unknown) => Value) {
  for (const handle of handles) {
    const value = read(data[handle]);
    if (value) {
      return value;
    }
  }
  return null;
}

/** A page's sections. Block types the site components don't know are left out. */
export function readBlocks(value: unknown): SiteBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item): SiteBlock[] => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const { id, type, data } = item as { id?: unknown; type?: unknown; data?: unknown };
    if (typeof id !== "string" || typeof data !== "object" || data === null) {
      return [];
    }
    const block = readBlock(id, type, data as Data);
    return block ? [block] : [];
  });
}

function readBlock(id: string, type: unknown, data: Data): SiteBlock | null {
  switch (type) {
    case "hero":
      return {
        type,
        id,
        heading: readText(data.heading),
        subheading: readText(data.subheading),
        image: readImage(data.image),
        button: readLink(data.button),
      };
    case "text":
      return { type, id, heading: readText(data.heading), body: readHtml(data.body) };
    case "image":
      return { type, id, image: readImage(data.image), caption: readText(data.caption) };
    case "call_to_action":
      return {
        type,
        id,
        heading: readText(data.heading),
        text: readText(data.text),
        button: readLink(data.button),
      };
    case "faq":
      return { type, id, question: readText(data.question), answer: readHtml(data.answer) };
    default:
      return null;
  }
}

export function entryTitle(entry: Pick<DeliveredEntry, "data" | "slug">): string {
  return readText(entry.data.title) || entry.slug;
}

const summaryFields = ["summary", "excerpt", "description"];
const imageFields = ["hero_image", "featured_image", "image"];

/** A plain-text line about the entry, for list cards and the page description. */
export function entrySummary(entry: Pick<DeliveredEntry, "data">): string {
  return firstOf(entry.data, summaryFields, readText) ?? "";
}

export function entryImage(entry: Pick<DeliveredEntry, "data">): SiteImage | null {
  return firstOf(entry.data, imageFields, readImage);
}

export function toPageView(entry: DeliveredEntry, scriptRule: CustomScriptRule): PageView {
  const sections = firstOf(entry.data, ["sections", "blocks"], (value) => {
    const blocks = readBlocks(value);
    return blocks.length > 0 ? blocks : null;
  });
  return {
    kind: "page",
    title: entryTitle(entry),
    summary: entrySummary(entry),
    heroImage: entryImage(entry),
    body: readHtml(entry.data.body),
    sections: sections ?? [],
    design: readPageDesign(entry.data.design, scriptRule),
  };
}

/** The terms an entry chose in its terms fields, by taxonomy handle. */
export function readTerms(
  value: unknown,
): Array<{ title: string; slug: string; taxonomy: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((term) => {
    if (typeof term !== "object" || term === null) {
      return [];
    }
    const { title, slug, taxonomy } = term as Record<string, unknown>;
    return typeof slug === "string" && typeof taxonomy === "string"
      ? [{ title: readText(title) || slug, slug, taxonomy }]
      : [];
  });
}

export function toPostView(
  entry: DeliveredEntry,
  links: {
    termUrl: (taxonomy: string, slug: string) => string | null;
    backLink: PostView["backLink"];
  },
): PostView {
  const termLinks = (handle: string): TermLink[] =>
    readTerms(entry.data[handle]).flatMap((term) => {
      const url = links.termUrl(term.taxonomy, term.slug);
      return url ? [{ title: term.title, url }] : [];
    });
  return {
    kind: "post",
    title: entryTitle(entry),
    excerpt: entrySummary(entry),
    publishedAt: entry.publishedAt,
    image: entryImage(entry),
    body: readHtml(entry.data.body),
    categories: termLinks("categories"),
    tags: termLinks("tags"),
    backLink: links.backLink,
  };
}

export function toPostSummary(entry: DeliveredEntry, url: string): PostSummary {
  return {
    id: entry.id,
    title: entryTitle(entry),
    url,
    excerpt: entrySummary(entry),
    publishedAt: entry.publishedAt,
    image: entryImage(entry),
  };
}
