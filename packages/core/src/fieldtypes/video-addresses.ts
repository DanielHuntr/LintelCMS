/**
 * What a video field's address points at: a YouTube or Vimeo video, or a video file. The
 * delivery API adds `provider` and `embedUrl`, so a website can show the right player
 * without parsing addresses itself.
 */
export interface VideoAddress {
  provider: "youtube" | "vimeo" | "file";
  /** For a player in an iframe, or the file itself. */
  embedUrl: string;
}

const YOUTUBE_ID = /^[\w-]{6,20}$/;

export function describeVideoAddress(address: string): VideoAddress | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  const youtubeId = findYoutubeId(host, url);
  if (youtubeId) {
    return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vimeoId = url.pathname.split("/").find((part) => /^\d+$/.test(part));
    return vimeoId
      ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeoId}` }
      : null;
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) {
    return { provider: "file", embedUrl: url.toString() };
  }
  return null;
}

function findYoutubeId(host: string, url: URL): string | null {
  let candidate: string | null | undefined = null;
  if (host === "youtu.be") {
    candidate = url.pathname.slice(1);
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    candidate =
      first === "watch"
        ? url.searchParams.get("v")
        : ["embed", "shorts", "live"].includes(first ?? "")
          ? second
          : null;
  }
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}
