import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { prettifyError } from "zod";
import { isLoopbackHost } from "../webhooks/address-safety.js";
import {
  checkWebhookAddress,
  lookupFor,
  type SenderOptions,
  WebhookSendError,
} from "../webhooks/webhook-sender.js";
import { type AppManifest, appManifestSchema } from "./app-manifest.schema.js";
import { AppManifestUnreachableError, InvalidAppManifestError } from "./apps.errors.js";

/**
 * Reading `lintel-app.json` from the address someone typed in. The same care as sending a
 * webhook (see src/webhooks/address-safety.ts): no private or local addresses unless the
 * server allows them, or apps' development mode allows this computer's own (see
 * app-development-mode.ts), checked on the address actually connected to; no
 * redirects; a short timeout; and a size limit far above any real manifest.
 */
const TIMEOUT_MILLISECONDS = 10_000;
const MAXIMUM_BYTES = 64 * 1024;

export async function fetchAppManifest(
  address: string,
  options: SenderOptions,
): Promise<AppManifest> {
  const url = new URL(address);
  const onThisComputer = isLoopbackHost(url);
  if (onThisComputer && !options.allowPrivateAddresses && !options.allowLoopbackAddresses) {
    throw new AppManifestUnreachableError(
      address,
      "it is on this computer. While you build an app, turn on development mode in Build → Apps",
    );
  }
  if (url.protocol !== "https:" && !onThisComputer && !options.allowPrivateAddresses) {
    throw new AppManifestUnreachableError(address, "the address needs to start with https://");
  }
  try {
    checkWebhookAddress(url, options);
  } catch (error) {
    if (error instanceof WebhookSendError) {
      throw new AppManifestUnreachableError(address, "it is a private or local address");
    }
    throw error;
  }
  const body = await download(url, options);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new InvalidAppManifestError("- It isn't valid JSON.");
  }
  return checkAppManifest(parsed);
}

/** Checks a manifest, pasted in or downloaded, and lists everything wrong with it. */
export function checkAppManifest(input: unknown): AppManifest {
  const result = appManifestSchema.safeParse(input);
  if (!result.success) {
    throw new InvalidAppManifestError(prettifyError(result.error));
  }
  return result.data;
}

function download(url: URL, options: SenderOptions): Promise<string> {
  const requestOptions: RequestOptions = {
    method: "GET",
    headers: { accept: "application/json", "user-agent": "Lintel" },
    timeout: TIMEOUT_MILLISECONDS,
    lookup: lookupFor(options),
  };
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  const fail = (reason: string) => new AppManifestUnreachableError(url.href, reason);

  return new Promise((resolve, reject) => {
    const outgoing = send(url, requestOptions, (response) => {
      const status = response.statusCode ?? 0;
      if (status !== 200) {
        response.resume();
        reject(fail(`it answered ${status} instead of the file`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAXIMUM_BYTES) {
          outgoing.destroy(fail("the file is far too big to be a manifest"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", (error) => reject(fail(error.message)));
    });
    outgoing.on("timeout", () => outgoing.destroy(fail("it took too long to answer")));
    outgoing.on("error", (error) =>
      reject(error instanceof AppManifestUnreachableError ? error : fail(error.message)),
    );
    outgoing.end();
  });
}
