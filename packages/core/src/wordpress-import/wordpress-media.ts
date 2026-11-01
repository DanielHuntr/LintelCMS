import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { extname } from "node:path";
import type { ZipArchiveReader } from "../archives/zip-reader.js";
import { MAX_UPLOAD_MEGABYTES } from "../media/media.errors.js";
import { bareHostname, isLocalHostName, isPrivateAddress } from "../webhooks/address-safety.js";
import { publicOnlyLookup } from "../webhooks/webhook-sender.js";
import { MediaNotAllowedError } from "./wordpress-import.errors.js";

/**
 * Where a WordPress site's images come from during an import: downloaded from the old
 * site, or read from a zip of its wp-content folder. Either way only these kinds of file,
 * up to the media library's usual size limit, are taken; the media library then checks
 * the bytes themselves as it does for any upload.
 */
export const allowedMediaExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".pdf",
];
export const MAX_MEDIA_BYTES = MAX_UPLOAD_MEGABYTES * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MILLISECONDS = 30_000;

export interface MediaSource {
  /** The file's bytes. Throws MediaNotAllowedError (with a reason for the report) if it can't. */
  fetch(url: string): Promise<Buffer>;
  /** For the dry run: throws as `fetch` would for what can be known without fetching. */
  check(url: string): Promise<void>;
}

/** Throws when the address's file type isn't one the importer brings in. */
export function checkMediaAddress(url: string): void {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    throw new MediaNotAllowedError("the address isn't a web address");
  }
  const extension = extname(pathname).toLowerCase();
  if (!allowedMediaExtensions.includes(extension)) {
    throw new MediaNotAllowedError(
      `${extension || "files without an extension"} isn't a file type Lintel imports`,
    );
  }
}

export interface DownloadOptions {
  /** For tests and local WordPress copies only, like WEBHOOKS_ALLOW_PRIVATE_ADDRESSES. */
  allowPrivateAddresses: boolean;
}

/**
 * The addresses images may be downloaded from: the old site's own (with and without
 * "www."), and any the person added on the mapping screen. Host names include the port,
 * if there is one.
 */
export function allowedMediaHosts(
  siteAddress: string,
  extraHosts: readonly string[] = [],
): Set<string> {
  const hosts = new Set(extraHosts.map((host) => host.toLowerCase()));
  try {
    const siteHost = new URL(siteAddress).host.toLowerCase();
    hosts.add(siteHost);
    hosts.add(siteHost.startsWith("www.") ? siteHost.slice(4) : `www.${siteHost}`);
  } catch {
    // An export without a site address: only the hosts given are allowed.
  }
  return hosts;
}

function checkMediaHost(url: string, allowedHosts: ReadonlySet<string>): void {
  const host = new URL(url).host.toLowerCase();
  if (!allowedHosts.has(host)) {
    throw new MediaNotAllowedError(
      `${host} isn't the old site's address. Add it to the addresses images may come from to bring it in`,
    );
  }
}

/**
 * Downloads from the old site. Only allowed hosts are fetched from, after every redirect
 * too, and addresses on the server's own network are refused (checked on the address
 * actually connected to), so a WordPress export can't be used to make Lintel fetch
 * something private or from anywhere it likes.
 */
export function downloadingMediaSource(
  options: DownloadOptions,
  allowedHosts: ReadonlySet<string>,
): MediaSource {
  const checkAddress = (url: string) => {
    checkMediaAddress(url);
    checkMediaHost(url, allowedHosts);
  };
  return {
    check: async (url) => checkAddress(url),
    async fetch(url) {
      checkAddress(url);
      let address = url;
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const response = await requestFile(address, options);
        if (response.redirectTo) {
          address = new URL(response.redirectTo, address).toString();
          checkMediaHost(address, allowedHosts);
          continue;
        }
        return response.body ?? Buffer.alloc(0);
      }
      throw new MediaNotAllowedError("the old site redirected too many times");
    },
  };
}

interface FileResponse {
  body?: Buffer;
  redirectTo?: string;
}

function requestFile(address: string, options: DownloadOptions): Promise<FileResponse> {
  const url = new URL(address);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return Promise.reject(new MediaNotAllowedError("only web addresses can be downloaded"));
  }
  const host = bareHostname(url);
  if (
    !options.allowPrivateAddresses &&
    (isLocalHostName(host) || (isIP(host) !== 0 && isPrivateAddress(host)))
  ) {
    return Promise.reject(new MediaNotAllowedError(`${host} is a private or local address`));
  }
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const outgoing = send(
      url,
      {
        method: "GET",
        timeout: TIMEOUT_MILLISECONDS,
        lookup: options.allowPrivateAddresses ? undefined : publicOnlyLookup,
      },
      (response) => readResponse(response).then(resolve, reject),
    );
    outgoing.on("timeout", () =>
      outgoing.destroy(new MediaNotAllowedError("the old site took too long to answer")),
    );
    outgoing.on("error", (error) =>
      reject(
        error instanceof MediaNotAllowedError ? error : new MediaNotAllowedError(error.message),
      ),
    );
    outgoing.end();
  });
}

async function readResponse(response: IncomingMessage): Promise<FileResponse> {
  const status = response.statusCode ?? 0;
  if (status >= 300 && status < 400 && response.headers.location) {
    response.resume();
    return { redirectTo: response.headers.location };
  }
  if (status !== 200) {
    response.resume();
    throw new MediaNotAllowedError(`the old site answered ${status}`);
  }
  if (Number(response.headers["content-length"] ?? 0) > MAX_MEDIA_BYTES) {
    response.destroy();
    throw new MediaNotAllowedError(`it is bigger than ${MAX_UPLOAD_MEGABYTES} MB`);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    size += (chunk as Buffer).length;
    if (size > MAX_MEDIA_BYTES) {
      response.destroy();
      throw new MediaNotAllowedError(`it is bigger than ${MAX_UPLOAD_MEGABYTES} MB`);
    }
    chunks.push(chunk as Buffer);
  }
  return { body: Buffer.concat(chunks) };
}

/**
 * Reads files from a zip of the old site's wp-content folder (or just its uploads folder).
 * ".../wp-content/uploads/2024/03/loaf.png" is found at "wp-content/uploads/2024/03/loaf.png",
 * "uploads/2024/03/loaf.png" or "2024/03/loaf.png" in the zip, whichever it has.
 */
export function contentZipMediaSource(zip: ZipArchiveReader): MediaSource {
  const names = zip.listNames();
  const findFile = (url: string): string => {
    checkMediaAddress(url);
    const name = findInContentZip(names, url);
    if (!name) {
      throw new MediaNotAllowedError("it isn't in the wp-content zip");
    }
    if ((zip.sizeOf(name) ?? 0) > MAX_MEDIA_BYTES) {
      throw new MediaNotAllowedError(`it is bigger than ${MAX_UPLOAD_MEGABYTES} MB`);
    }
    return name;
  };
  return {
    check: async (url) => void findFile(url),
    fetch: (url) => zip.readBuffer(findFile(url)),
  };
}

export function findInContentZip(names: readonly string[], url: string): string | undefined {
  const path = decodeURIComponent(new URL(url).pathname);
  const afterUploads = path.split("/uploads/").at(-1) ?? path;
  const candidates = [
    `wp-content/uploads/${afterUploads}`,
    `uploads/${afterUploads}`,
    afterUploads,
  ];
  return candidates
    .map((candidate) => names.find((name) => name === candidate || name.endsWith(`/${candidate}`)))
    .find((name) => name !== undefined);
}
