import { z } from "zod";
import {
  FreePhotoNotFoundError,
  FreePhotosBusyError,
  FreePhotosUnavailableError,
} from "./free-photos.errors.js";
import { allowedLicences, PHOTOS_PER_PAGE } from "./free-photos.schema.js";
import { TimedCache } from "./timed-cache.js";

/**
 * Talks to Openverse (openverse.org), the open search engine for openly licensed media run
 * by WordPress.org. Its public API needs no key. This is the feature's "repository": the
 * only place that knows Openverse's addresses and answers.
 *
 * Polite use: every request says who it is (a user agent naming Lintel), gives up after a
 * few seconds, and searches and thumbnails are kept briefly, so paging back and forth or
 * two people searching for the same thing don't ask again. Anonymous use is limited per
 * server (20 searches a minute, 200 a day, 1,000 thumbnails a day at the time of writing).
 */
export const OPENVERSE_API_URL = "https://api.openverse.org";

const USER_AGENT = "LintelCMS (self-hosted CMS; https://github.com/DanielHuntr/LintelCMS)";
const TIMEOUT_MILLISECONDS = 8_000;
const SEARCH_CACHE_MILLISECONDS = 10 * 60_000;
const THUMBNAIL_CACHE_MILLISECONDS = 60 * 60_000;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

/** One image as Openverse describes it; only the fields Lintel uses. */
const openverseImageSchema = z.object({
  id: z.uuid(),
  title: z.string().nullish(),
  url: z.string(),
  foreign_landing_url: z.string().nullish(),
  creator: z.string().nullish(),
  creator_url: z.string().nullish(),
  license: z.string(),
  license_version: z.string().nullish(),
  license_url: z.string().nullish(),
  source: z.string().nullish(),
  provider: z.string().nullish(),
  width: z.number().int().nullish(),
  height: z.number().int().nullish(),
  mature: z.boolean().nullish(),
});

const openverseSearchSchema = z.object({
  page: z.number().int().optional(),
  page_count: z.number().int(),
  results: z.array(z.unknown()),
});

export type OpenverseImage = z.infer<typeof openverseImageSchema>;

export interface OpenverseSearchResult {
  images: OpenverseImage[];
  pageCount: number;
}

export interface OpenverseThumbnail {
  body: Buffer;
  contentType: string;
}

export interface OpenverseClientOptions {
  /** Openverse's API address; tests point it at a stand-in. */
  apiUrl?: string;
}

export interface OpenverseClient {
  searchImages(searchText: string, page: number): Promise<OpenverseSearchResult>;
  findImage(imageId: string): Promise<OpenverseImage>;
  findThumbnail(imageId: string): Promise<OpenverseThumbnail>;
}

export function createOpenverseClient(options: OpenverseClientOptions = {}): OpenverseClient {
  const apiUrl = (options.apiUrl ?? OPENVERSE_API_URL).replace(/\/+$/, "");
  const searches = new TimedCache<OpenverseSearchResult>(SEARCH_CACHE_MILLISECONDS, 200);
  const thumbnails = new TimedCache<OpenverseThumbnail>(THUMBNAIL_CACHE_MILLISECONDS, 300);

  return {
    async searchImages(searchText, page) {
      const query = new URLSearchParams({
        q: searchText,
        page: String(page),
        page_size: String(PHOTOS_PER_PAGE),
        // Asked for here and checked again on every result, in case Openverse adds one.
        license: allowedLicences.join(","),
        mature: "false",
      });
      const key = query.toString();
      const cached = searches.read(key);
      if (cached) return cached;

      const response = await send(`${apiUrl}/v1/images/?${key}`);
      const parsed = openverseSearchSchema.safeParse(await readJson(response));
      if (!parsed.success) throw new FreePhotosUnavailableError();
      const images = parsed.data.results.flatMap((result) => {
        const image = openverseImageSchema.safeParse(result);
        return image.success ? [image.data] : [];
      });
      const found = { images, pageCount: parsed.data.page_count };
      searches.write(key, found);
      return found;
    },

    async findImage(imageId) {
      const response = await send(`${apiUrl}/v1/images/${encodeURIComponent(imageId)}/`);
      const parsed = openverseImageSchema.safeParse(await readJson(response));
      if (!parsed.success) throw new FreePhotosUnavailableError();
      return parsed.data;
    },

    async findThumbnail(imageId) {
      const cached = thumbnails.read(imageId);
      if (cached) return cached;
      const response = await send(`${apiUrl}/v1/images/${encodeURIComponent(imageId)}/thumb/`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/") || contentType.includes("svg")) {
        throw new FreePhotosUnavailableError();
      }
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length > MAX_THUMBNAIL_BYTES) throw new FreePhotosUnavailableError();
      const thumbnail = { body, contentType };
      thumbnails.write(imageId, thumbnail);
      return thumbnail;
    },
  };
}

/** One GET to Openverse, with its errors turned into ones people can act on. */
async function send(url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json, image/*" },
      signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS),
      redirect: "follow",
    });
  } catch {
    throw new FreePhotosUnavailableError();
  }
  // 424: Openverse still lists the photo, but the site it came from no longer has it.
  if (response.status === 404 || response.status === 424) throw new FreePhotoNotFoundError();
  if (response.status === 429) throw new FreePhotosBusyError();
  if (!response.ok) throw new FreePhotosUnavailableError();
  return response;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new FreePhotosUnavailableError();
  }
}
