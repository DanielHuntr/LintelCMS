import { z } from "zod";
import { InstagramRequestError } from "./instagram.errors.js";

/**
 * Talking to Instagram (the Instagram API with Instagram Login, graph.instagram.com), from the
 * server only. `fetch` is handed in, so tests can answer for Instagram.
 */

export type FetchFunction = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

const GRAPH = "https://graph.instagram.com";
const TIMEOUT_MILLISECONDS = 15_000;
/** Bigger than any picture Instagram serves; anything larger is refused. */
const LARGEST_PICTURE_BYTES = 8 * 1024 * 1024;

const profileSchema = z.object({
  user_id: z.union([z.string(), z.number()]),
  username: z.string(),
});

const mediaSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      caption: z.string().optional(),
      media_type: z.string(),
      media_url: z.string().optional(),
      thumbnail_url: z.string().optional(),
      permalink: z.string(),
      timestamp: z.string(),
    }),
  ),
});

const refreshedTokenSchema = z.object({ access_token: z.string() });

const errorSchema = z.object({
  error: z.object({ message: z.string().optional(), code: z.number().optional() }),
});

export interface InstagramProfile {
  userId: string;
  username: string;
}

export interface InstagramMedia {
  instagramId: string;
  caption: string;
  mediaType: string;
  /** The picture to keep: the photo, or a video's still. */
  pictureUrl: string;
  permalink: string;
  postedAt: Date;
}

export interface DownloadedPicture {
  bytes: Uint8Array;
  type: string;
}

export interface InstagramClient {
  readProfile(accessToken: string): Promise<InstagramProfile>;
  listMedia(accessToken: string, limit: number): Promise<InstagramMedia[]>;
  refreshToken(accessToken: string): Promise<string>;
  downloadPicture(url: string): Promise<DownloadedPicture>;
}

export function createInstagramClient(fetchFunction: FetchFunction): InstagramClient {
  async function readJson(path: string, accessToken: string): Promise<unknown> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${GRAPH}${path}${separator}access_token=${encodeURIComponent(accessToken)}`;
    const response = await send(fetchFunction, url);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new InstagramRequestError(describeRefusal(response.status, body));
    return body;
  }

  return {
    async readProfile(accessToken) {
      const parsed = profileSchema.safeParse(
        await readJson("/me?fields=user_id,username", accessToken),
      );
      if (!parsed.success) throw unexpectedAnswer();
      return { userId: String(parsed.data.user_id), username: parsed.data.username };
    },

    async listMedia(accessToken, limit) {
      const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
      const parsed = mediaSchema.safeParse(
        await readJson(`/me/media?fields=${fields}&limit=${limit}`, accessToken),
      );
      if (!parsed.success) throw unexpectedAnswer();
      const media: InstagramMedia[] = [];
      for (const item of parsed.data.data) {
        const pictureUrl = item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url;
        const postedAt = new Date(item.timestamp);
        if (!pictureUrl || Number.isNaN(postedAt.getTime())) continue;
        media.push({
          instagramId: item.id,
          caption: item.caption ?? "",
          mediaType: item.media_type,
          pictureUrl,
          permalink: item.permalink,
          postedAt,
        });
      }
      return media;
    },

    async refreshToken(accessToken) {
      const parsed = refreshedTokenSchema.safeParse(
        await readJson("/refresh_access_token?grant_type=ig_refresh_token", accessToken),
      );
      if (!parsed.success) throw unexpectedAnswer();
      return parsed.data.access_token;
    },

    async downloadPicture(url) {
      if (!url.startsWith("https://")) {
        throw new InstagramRequestError("Instagram gave a picture address Lintel can't use.");
      }
      const response = await send(fetchFunction, url);
      const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
      if (!response.ok || !type.startsWith("image/")) {
        throw new InstagramRequestError(
          "A picture couldn't be copied from Instagram. Lintel will try again within the hour.",
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > LARGEST_PICTURE_BYTES) {
        throw new InstagramRequestError("A picture from Instagram was too large to keep.");
      }
      return { bytes, type };
    },
  };
}

async function send(fetchFunction: FetchFunction, url: string): Promise<Response> {
  try {
    return await fetchFunction(url, { signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS) });
  } catch {
    throw new InstagramRequestError(
      "Lintel couldn't reach Instagram. Check the server is online; it will try again within the hour.",
    );
  }
}

/** Instagram's refusal, in words a site owner can act on. */
function describeRefusal(status: number, body: unknown): string {
  const parsed = errorSchema.safeParse(body);
  const code = parsed.success ? parsed.data.error.code : undefined;
  if (code === 190 || status === 401) {
    return "Instagram didn't accept the access token. It may have expired or been revoked: make a new one and paste it here.";
  }
  if (code === 4 || code === 17 || status === 429) {
    return "Instagram asked Lintel to slow down. It will try again within the hour.";
  }
  const detail = parsed.success ? parsed.data.error.message : undefined;
  return detail
    ? `Instagram said: “${detail}”`
    : `Instagram answered with an error (${status}). Lintel will try again within the hour.`;
}

function unexpectedAnswer(): InstagramRequestError {
  return new InstagramRequestError(
    "Instagram's answer wasn't what Lintel expected. Lintel will try again within the hour.",
  );
}
