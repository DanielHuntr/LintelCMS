/**
 * Types and a client for this site's content, made by `lintel model types` from the
 * content model. Don't edit this file: change the content model and run the command again.
 */

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
export interface DeliveredRichText {
  json: unknown;
  html: string;
}

/** A Markdown field's value: the text as written, and its HTML. */
export interface DeliveredMarkdown {
  markdown: string;
  html: string;
}

/**
 * A page field's value: a design from the visual page builder, as versioned JSON. Draw it
 * with `renderPage` from `@lintel/builder/render`.
 */
export interface DeliveredPageDesign {
  version: number;
  root: Record<string, unknown>;
}

/** A link field's value. */
export interface DeliveredLink {
  url: string;
  label?: string;
}

/** A term chosen in a terms field. */
export interface DeliveredTerm {
  id: string;
  title: string;
  slug: string;
  taxonomy: string;
}

/** A published entry chosen in an entries field. */
export interface DeliveredEntryLink {
  id: string;
  title: string;
  slug: string;
  url: string | null;
  collection: string;
  locale: string;
}

/** One published entry. `Data` holds its fields, keyed by handle. */
export interface DeliveredEntry<Data> {
  id: string;
  slug: string;
  /** Where the entry lives on the site, such as "/blog/hello-world". Null if it has no page. */
  url: string | null;
  locale: string;
  /** When it was published, as an ISO date. */
  publishedAt: string | null;
  data: Data;
}

/** A single entry, with where it is published in the site's other languages. */
export interface DeliveredEntryWithTranslations<Data> extends DeliveredEntry<Data> {
  translations: { locale: string; slug: string; url: string | null }[];
}

/** A page of entries from a collection, with the total for pagination. */
export interface DeliveredList<Data> {
  items: DeliveredEntry<Data>[];
  total: number;
}

export interface DeliveredGlobalSet<Data> {
  handle: string;
  name: string;
  locale: string;
  data: Data;
}

export interface DeliveredMenuItem {
  label: string;
  url: string | null;
  newTab: boolean;
  entryId: string | null;
  children: DeliveredMenuItem[];
}

export interface DeliveredMenu {
  handle: string;
  name: string;
  locale: string;
  items: DeliveredMenuItem[];
}

export interface DeliveredTaxonomy {
  handle: string;
  name: string;
  items: { id: string; title: string; slug: string; description: string }[];
}

/** The content type Page (`page`), used by Pages (`pages`). */
export interface PageData {
  /** Title */
  title: string;
  /** Summary. A sentence or two for search results and link previews */
  summary: string | null;
  /** Hero image. Shown at the top of the page */
  hero_image: DeliveredImage | null;
  /** Body */
  body: DeliveredRichText | null;
  /** Design. How the page looks: lay it out visually with Edit design. */
  design: DeliveredPageDesign | null;
}

/** The content type Blog post (`post`), used by Blog posts (`posts`). */
export interface PostData {
  /** Title */
  title: string;
  /** Excerpt. Shown in lists of posts and in link previews */
  excerpt: string | null;
  /** Featured image */
  featured_image: DeliveredImage | null;
  /** Body */
  body: DeliveredRichText | null;
  /** Categories */
  categories: DeliveredTerm[] | null;
  /** Tags */
  tags: DeliveredTerm[] | null;
}

/** The global set Site settings (`site_settings`). */
export interface SiteSettingsData {
  /** Site name. Shown in the header and in browser tabs */
  site_name: string | null;
  /** Footer text. A line or two at the bottom of every page */
  footer_text: string | null;
  /** Contact email */
  contact_email: string | null;
  /** Social links. One web address in each box, such as your Instagram or LinkedIn page */
  social_links: string[] | null;
}

/** Each collection's entries' data, by collection handle. */
export interface CollectionData {
  pages: PageData;
  posts: PostData;
}

/** Each global set's data, by handle. */
export interface GlobalSetData {
  site_settings: SiteSettingsData;
}

export type CollectionHandle = keyof CollectionData;
export type GlobalSetHandle = keyof GlobalSetData;
export type TaxonomyHandle = "categories" | "tags";
export type MenuHandle = "main";

/** What a request is for, so a site can cache or tag it (Next.js: `next: { tags }`). */
export interface LintelRequest {
  path: string;
  resource: "entries" | "globals" | "menus" | "taxonomies";
  handle: string;
}

export interface LintelClientOptions {
  /** Where Lintel's API is, such as "http://localhost:4000". */
  apiUrl: string;
  /** An API token, for sites set to need one (Settings, then API access). */
  token?: string;
  /** Extra fetch options for a request, such as caching rules. */
  requestInit?: (request: LintelRequest) => RequestInit;
}

/** Lintel answered, but with an error (other than "not found"). */
export class LintelRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(`Lintel couldn't send ${path} (${status}): ${message}`);
    this.name = "LintelRequestError";
  }
}

/** Lintel didn't answer at all: it isn't running, or the address is wrong. */
export class LintelUnreachableError extends Error {
  constructor(readonly apiUrl: string) {
    super(`Can't reach Lintel at ${apiUrl}. Check that Lintel is running and that its address is right.`);
    this.name = "LintelUnreachableError";
  }
}

export interface ListEntriesOptions {
  /** Starts at 1. */
  page?: number;
  /** 25 by default, 100 at most. */
  perPage?: number;
  locale?: string;
  /** With `term`: only entries that chose this term. */
  taxonomy?: TaxonomyHandle;
  term?: string;
}

/**
 * Typed reads from the delivery API. Each gives null for a 404 (nothing published there),
 * so pages can show "not found".
 *
 *   const lintel = createLintelClient({ apiUrl: "http://localhost:4000" });
 *   const post = await lintel.getEntry("posts", "hello-world");
 */
export function createLintelClient(options: LintelClientOptions) {
  const apiUrl = options.apiUrl.replace(/\/+$/, "");

  async function read<Result>(request: LintelRequest): Promise<Result | null> {
    const init = options.requestInit?.(request) ?? {};
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (options.token) headers.set("authorization", `Bearer ${options.token}`);
    let response: Response;
    try {
      response = await fetch(`${apiUrl}${request.path}`, { ...init, headers });
    } catch {
      throw new LintelUnreachableError(apiUrl);
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new LintelRequestError(response.status, request.path, await errorMessage(response));
    }
    return (await response.json()) as Result;
  }

  const query = (values: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const text = search.toString();
    return text === "" ? "" : `?${text}`;
  };

  return {
    /** One published entry by its slug. */
    getEntry<Collection extends CollectionHandle>(
      collection: Collection,
      slug: string,
      { locale }: { locale?: string } = {},
    ) {
      const path = `/delivery/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}${query({ locale })}`;
      return read<DeliveredEntryWithTranslations<CollectionData[Collection]>>({
        path,
        resource: "entries",
        handle: collection,
      });
    },
    /** A page of published entries. Null if the collection doesn't exist. */
    listEntries<Collection extends CollectionHandle>(
      collection: Collection,
      { page = 1, perPage = 25, ...filters }: ListEntriesOptions = {},
    ) {
      const path = `/delivery/${encodeURIComponent(collection)}${query({ page, perPage, ...filters })}`;
      return read<DeliveredList<CollectionData[Collection]>>({
        path,
        resource: "entries",
        handle: collection,
      });
    },
    /** A global set's values. */
    getGlobalSet<Handle extends GlobalSetHandle>(handle: Handle, { locale }: { locale?: string } = {}) {
      const path = `/delivery/globals/${encodeURIComponent(handle)}${query({ locale })}`;
      return read<DeliveredGlobalSet<GlobalSetData[Handle]>>({ path, resource: "globals", handle });
    },
    /** A menu, with addresses ready to print. */
    getMenu(handle: MenuHandle, { locale }: { locale?: string } = {}) {
      const path = `/delivery/navigation/${encodeURIComponent(handle)}${query({ locale })}`;
      return read<DeliveredMenu>({ path, resource: "menus", handle });
    },
    /** A taxonomy's terms. */
    getTaxonomy(handle: TaxonomyHandle) {
      const path = `/delivery/taxonomies/${encodeURIComponent(handle)}`;
      return read<DeliveredTaxonomy>({ path, resource: "taxonomies", handle });
    },
  };
}

export type LintelClient = ReturnType<typeof createLintelClient>;

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      return String(body.message);
    }
  } catch {
    // Not JSON; the status says enough.
  }
  return response.statusText;
}
