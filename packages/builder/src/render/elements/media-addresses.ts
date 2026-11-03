/**
 * Addresses for media from other sites, worked out from what editors paste: YouTube's
 * privacy-enhanced player (youtube-nocookie.com), Vimeo without tracking (`dnt=1`) and an
 * OpenStreetMap embed around a pin.
 */

export interface VideoEmbed {
  provider: "youtube" | "vimeo";
  embedUrl: string;
  watchUrl: string;
}

export function youTubeId(address: string): string | null {
  const patterns = [
    /youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(address);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function vimeoId(address: string): string | null {
  return /vimeo\.com\/(?:video\/)?(\d{6,12})/i.exec(address)?.[1] ?? null;
}

export function videoEmbed(
  source: string,
  address: string,
  muted: boolean,
  loop: boolean,
): VideoEmbed | null {
  if (source === "youtube") {
    const id = youTubeId(address);
    if (!id) return null;
    const query = new URLSearchParams({ autoplay: "1", rel: "0" });
    if (muted) query.set("mute", "1");
    if (loop) {
      query.set("loop", "1");
      query.set("playlist", id);
    }
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${query.toString()}`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  if (source === "vimeo") {
    const id = vimeoId(address);
    if (!id) return null;
    const query = new URLSearchParams({ autoplay: "1", dnt: "1" });
    if (muted) query.set("muted", "1");
    if (loop) query.set("loop", "1");
    return {
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${id}?${query.toString()}`,
      watchUrl: `https://vimeo.com/${id}`,
    };
  }
  return null;
}

/** The area an OpenStreetMap embed shows: roughly a few streets at zoom 15. */
export function openStreetMapAddresses(latitude: number, longitude: number, zoom: number) {
  const width = (360 / 2 ** zoom) * 2;
  const height = width * 0.6;
  const round = (value: number) => Number(value.toFixed(5));
  const box = [
    round(longitude - width / 2),
    round(latitude - height / 2),
    round(longitude + width / 2),
    round(latitude + height / 2),
  ].join(",");
  const marker = `${round(latitude)},${round(longitude)}`;
  return {
    embedUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&layer=mapnik&marker=${encodeURIComponent(marker)}`,
    linkUrl: `https://www.openstreetmap.org/?mlat=${round(latitude)}&mlon=${round(longitude)}#map=${zoom}/${round(latitude)}/${round(longitude)}`,
  };
}

/**
 * A title as it reads after a verb in a sentence-case button: "Video" becomes "video", but a
 * name that starts with an acronym or a capitalised word inside ("YouTube", "BBC") stays.
 */
export function inSentence(title: string): string {
  const [first = "", second = ""] = title;
  return second && second === second.toUpperCase() && second !== second.toLowerCase()
    ? title
    : first.toLowerCase() + title.slice(1);
}
