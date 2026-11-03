import { looksLikeZip, readZip } from "./unzip.js";

/**
 * A Lottie animation's data from a file: a plain .json, or a .lottie (a zip holding the JSON
 * and any pictures it uses, which are put back inside it so nothing else is fetched).
 */

export interface LottieAsset {
  id?: string;
  /** The picture's file name, or a data: address once embedded. */
  p?: string;
  /** The folder it is in. */
  u?: string;
  /** 1 when `p` is the picture itself. */
  e?: number;
}

export interface LottieData {
  assets?: LottieAsset[];
  [key: string]: unknown;
}

const pictureTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
};

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

const asText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** Unpacks a .lottie: its first animation, with its pictures embedded. */
export async function readDotLottie(bytes: Uint8Array): Promise<LottieData> {
  const entries = readZip(bytes);
  const find = (name: string) => entries.find((entry) => entry.name === name);
  let animationName: string | undefined;
  const manifest = find("manifest.json");
  if (manifest) {
    const listed = JSON.parse(asText(await manifest.read())) as {
      animations?: Array<{ id?: string }>;
    };
    const id = listed.animations?.[0]?.id;
    if (id) animationName = `animations/${id}.json`;
  }
  const animation =
    (animationName && find(animationName)) ||
    entries.find((entry) => /^animations\/[^/]+\.json$/.test(entry.name));
  if (!animation) throw new Error("This .lottie file has no animation in it.");
  const data = JSON.parse(asText(await animation.read())) as LottieData;
  for (const asset of data.assets ?? []) {
    if (!asset.p || asset.e === 1) continue;
    const picture = find(`images/${asset.p}`) ?? find(`i/${asset.p}`);
    const type = pictureTypes[asset.p.split(".").pop()?.toLowerCase() ?? ""];
    if (!picture || !type) continue;
    asset.p = `data:${type};base64,${base64(await picture.read())}`;
    asset.u = "";
    asset.e = 1;
  }
  return data;
}

/** Fetches and reads a Lottie file, whichever of the two kinds it is. */
export async function loadLottieData(address: string): Promise<LottieData> {
  const response = await fetch(address);
  if (!response.ok) throw new Error(`The animation at ${address} couldn't be loaded.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return looksLikeZip(bytes) ? readDotLottie(bytes) : (JSON.parse(asText(bytes)) as LottieData);
}
