/**
 * Downloads a product photo from Shopify's CDN. Only addresses on Shopify's own image hosts
 * are fetched, over HTTPS, so a crafted file can't make the server fetch anything else
 * (another site, or something on its own network). Redirects are followed only to those
 * hosts, and a photo larger than the limit is stopped mid-download.
 *
 * Anything refused is skipped with a reason for the import report; the product is still
 * imported without it.
 */
export const SHOPIFY_IMAGE_HOSTS = ["cdn.shopify.com", "cdn.shopifycdn.net"] as const;

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MILLISECONDS = 20_000;

export type ImageDownload =
  { ok: true; contents: Buffer; filename: string } | { ok: false; reason: string };

/** Why an address won't be fetched, or null when it may be. */
export function imageAddressProblem(address: string): string | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return "isn't a web address";
  }
  if (url.protocol !== "https:") return "isn't an https:// address";
  if (!(SHOPIFY_IMAGE_HOSTS as readonly string[]).includes(url.hostname)) {
    return `is on ${url.hostname}, not Shopify's image server, so it wasn't downloaded`;
  }
  if (url.username || url.password || (url.port !== "" && url.port !== "443")) {
    return "isn't a plain Shopify image address";
  }
  return null;
}

export async function downloadShopifyImage(
  fetcher: typeof fetch,
  address: string,
): Promise<ImageDownload> {
  let current = address;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const problem = imageAddressProblem(current);
    if (problem) return { ok: false, reason: `The photo ${problem}` };
    let response: Response;
    try {
      response = await fetcher(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: `The photo couldn't be downloaded (${reason})` };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location)
        return { ok: false, reason: "Shopify sent the photo elsewhere without saying where" };
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      return { ok: false, reason: `Shopify answered ${response.status} for the photo` };
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      return { ok: false, reason: "The address doesn't lead to a photo" };
    }
    const contents = await readLimited(response);
    if (!contents) {
      return { ok: false, reason: `The photo is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB` };
    }
    return { ok: true, contents, filename: filenameOf(current) };
  }
  return { ok: false, reason: "Shopify redirected the photo too many times" };
}

async function readLimited(response: Response): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function filenameOf(address: string): string {
  const last = new URL(address).pathname.split("/").pop() ?? "";
  return decodeURIComponent(last) || "product-photo";
}
