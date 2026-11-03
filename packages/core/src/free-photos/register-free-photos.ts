import type { FastifyInstance } from "fastify";
import type { MediaContext } from "../media/index.js";
import type { FreePhotosContext } from "./free-photos.service.js";
import { createOpenverseClient } from "./openverse-client.js";

declare module "fastify" {
  interface FastifyInstance {
    /** What the Free photos plugin's routes need besides the request (see src/free-photos). */
    freePhotos: FreePhotosRuntime;
  }
}

export interface FreePhotosRuntime {
  /** Openverse, the media library and the download rules, for one request. */
  context: () => FreePhotosContext;
}

export interface FreePhotosOptions {
  /** Openverse's API address. Defaults to the real one; tests use a stand-in. */
  openverseApiUrl?: string;
  /**
   * Allow downloading photos from local and private addresses. Off unless the server allows
   * webhooks to private addresses, for testing only.
   */
  allowPrivateDownloads?: boolean;
}

/**
 * Everything free photos add to the server besides their routes (which are the Free photos
 * plugin's, see free-photos.plugin.ts). The Openverse client keeps its short cache for as
 * long as the server runs.
 */
export function registerFreePhotos(
  server: FastifyInstance,
  options: FreePhotosOptions,
  media: () => MediaContext,
): void {
  const openverse = createOpenverseClient({ apiUrl: options.openverseApiUrl });
  const download = { allowPrivateAddresses: options.allowPrivateDownloads ?? false };
  server.decorate("freePhotos", {
    context: () => ({ openverse, media: media(), download }),
  });
}
