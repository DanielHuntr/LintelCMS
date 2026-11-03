import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { MAX_UPLOAD_MEGABYTES } from "../media/media.errors.js";
import { bareHostname, isLocalHostName, isPrivateAddress } from "../webhooks/address-safety.js";
import { publicOnlyLookup } from "../webhooks/webhook-sender.js";
import { FreePhotoDownloadError } from "./free-photos.errors.js";

/**
 * Downloads a free photo's full-size file from wherever Openverse says it lives (Flickr,
 * Wikimedia Commons, a museum's site). That address comes from another service, so it gets
 * the same outgoing-request safety as webhooks (src/webhooks/address-safety.ts): local and
 * private addresses are refused, checked on the address actually connected to, and again
 * after every redirect. Files are limited to the media library's usual size.
 */
const MAX_PHOTO_BYTES = MAX_UPLOAD_MEGABYTES * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MILLISECONDS = 20_000;
const USER_AGENT = "LintelCMS (self-hosted CMS; https://github.com/DanielHuntr/LintelCMS)";

export interface PhotoDownloadOptions {
  /** For tests and local stand-ins only, like WEBHOOKS_ALLOW_PRIVATE_ADDRESSES. */
  allowPrivateAddresses: boolean;
}

export async function downloadPhoto(url: string, options: PhotoDownloadOptions): Promise<Buffer> {
  let address = url;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await requestPhoto(address, options);
    if (response.redirectTo === undefined) return response.body;
    address = new URL(response.redirectTo, address).toString();
  }
  throw new FreePhotoDownloadError("its address redirected too many times");
}

type PhotoResponse = { body: Buffer; redirectTo?: undefined } | { redirectTo: string };

function requestPhoto(address: string, options: PhotoDownloadOptions): Promise<PhotoResponse> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return Promise.reject(new FreePhotoDownloadError("its address isn't a web address"));
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return Promise.reject(new FreePhotoDownloadError("only web addresses can be downloaded"));
  }
  const host = bareHostname(url);
  if (
    !options.allowPrivateAddresses &&
    (isLocalHostName(host) || (isIP(host) !== 0 && isPrivateAddress(host)))
  ) {
    return Promise.reject(new FreePhotoDownloadError(`${host} is a private or local address`));
  }
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const outgoing = send(
      url,
      {
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "image/*" },
        timeout: TIMEOUT_MILLISECONDS,
        lookup: options.allowPrivateAddresses ? undefined : publicOnlyLookup,
      },
      (response) => readPhoto(response).then(resolve, reject),
    );
    outgoing.on("timeout", () =>
      outgoing.destroy(new FreePhotoDownloadError(`${host} took too long to answer`)),
    );
    outgoing.on("error", (error) =>
      reject(
        error instanceof FreePhotoDownloadError
          ? error
          : new FreePhotoDownloadError(describeConnectionError(error, host)),
      ),
    );
    outgoing.end();
  });
}

function describeConnectionError(error: Error, host: string): string {
  if (error.message.includes("private or local address")) {
    return `${host} points to a private or local address`;
  }
  const code = "code" in error ? String(error.code) : "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `${host} couldn't be found`;
  return `${host} didn't answer`;
}

async function readPhoto(response: IncomingMessage): Promise<PhotoResponse> {
  const status = response.statusCode ?? 0;
  if (status >= 300 && status < 400 && response.headers.location) {
    response.resume();
    return { redirectTo: response.headers.location };
  }
  if (status !== 200) {
    response.resume();
    throw new FreePhotoDownloadError(`the site it's on answered ${status}`);
  }
  if (Number(response.headers["content-length"] ?? 0) > MAX_PHOTO_BYTES) {
    response.destroy();
    throw new FreePhotoDownloadError(`it is bigger than ${MAX_UPLOAD_MEGABYTES} MB`);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const piece = chunk as Buffer;
    size += piece.length;
    if (size > MAX_PHOTO_BYTES) {
      response.destroy();
      throw new FreePhotoDownloadError(`it is bigger than ${MAX_UPLOAD_MEGABYTES} MB`);
    }
    chunks.push(piece);
  }
  return { body: Buffer.concat(chunks) };
}
